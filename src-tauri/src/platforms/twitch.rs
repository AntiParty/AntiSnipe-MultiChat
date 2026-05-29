use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::app_state::AppState;
use crate::events;
use crate::models::{
    BadgeInfo, ConnectionState, ConnectionStatus, DeleteMessageEvent, MessagePart, MessageType,
    NormalizedMessage, Platform, ReplyContext,
};

#[derive(Debug, Clone, PartialEq)]
pub enum TwitchIrcEvent {
    Message(NormalizedMessage),
    Delete(DeleteMessageEvent),
}

pub fn connect_anonymous<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: AppState,
    channel_id: String,
    slug: String,
) -> Result<(), String> {
    let normalized_slug = slug.trim().trim_start_matches('#').to_lowercase();
    if normalized_slug.is_empty() {
        return Err("Twitch channel slug is required".to_string());
    }

    let connecting = ConnectionState {
        channel_id: channel_id.clone(),
        status: ConnectionStatus::Connecting,
        error: None,
        connected_at: None,
        reconnect_attempt: None,
    };
    state.set_connection_state(connecting.clone());
    events::emit_connection_state(&app, connecting).map_err(|error| error.to_string())?;

    let task_channel_id = channel_id.clone();
    let task_state = state.clone();
    let task_app = app.clone();
    let task = tauri::async_runtime::spawn(async move {
        if let Err(error) = run_twitch_irc(
            task_app.clone(),
            task_state.clone(),
            task_channel_id.clone(),
            normalized_slug,
        )
        .await
        {
            let failed = ConnectionState {
                channel_id: task_channel_id,
                status: ConnectionStatus::Error,
                error: Some(error),
                connected_at: None,
                reconnect_attempt: None,
            };
            task_state.set_connection_state(failed.clone());
            let _ = events::emit_connection_state(&task_app, failed);
        }
    });

    state.replace_connection_task(channel_id, task);
    Ok(())
}

async fn run_twitch_irc<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: AppState,
    channel_id: String,
    slug: String,
) -> Result<(), String> {
    let (socket, _) = connect_async("wss://irc-ws.chat.twitch.tv:443")
        .await
        .map_err(|error| format!("failed to connect to Twitch IRC: {error}"))?;
    let (mut write, mut read) = socket.split();
    let nick = format!("justinfan{}", current_millis() % 100_000);

    write
        .send(Message::Text(
            "CAP REQ :twitch.tv/tags twitch.tv/commands".into(),
        ))
        .await
        .map_err(|error| format!("failed to request Twitch IRC capabilities: {error}"))?;
    write
        .send(Message::Text("PASS SCHMOOPIIE".into()))
        .await
        .map_err(|error| format!("failed to send anonymous Twitch password: {error}"))?;
    write
        .send(Message::Text(format!("NICK {nick}").into()))
        .await
        .map_err(|error| format!("failed to send anonymous Twitch nick: {error}"))?;
    write
        .send(Message::Text(format!("JOIN #{slug}").into()))
        .await
        .map_err(|error| format!("failed to join Twitch channel: {error}"))?;

    let connected = ConnectionState {
        channel_id: channel_id.clone(),
        status: ConnectionStatus::Connected,
        error: None,
        connected_at: Some(current_millis()),
        reconnect_attempt: None,
    };
    state.set_connection_state(connected.clone());
    events::emit_connection_state(&app, connected).map_err(|error| error.to_string())?;

    while let Some(next) = read.next().await {
        let message = next.map_err(|error| format!("Twitch IRC read failed: {error}"))?;
        let Message::Text(text) = message else {
            continue;
        };

        for line in text.lines().filter(|line| !line.trim().is_empty()) {
            if let Some(token) = line.strip_prefix("PING ") {
                write
                    .send(Message::Text(format!("PONG {token}").into()))
                    .await
                    .map_err(|error| format!("failed to respond to Twitch ping: {error}"))?;
                continue;
            }

            match parse_irc_line(line, &channel_id) {
                Some(TwitchIrcEvent::Message(message)) => {
                    events::emit_message_batch(&app, vec![message])
                        .map_err(|error| error.to_string())?;
                }
                Some(TwitchIrcEvent::Delete(event)) => {
                    events::emit_delete_message(&app, event).map_err(|error| error.to_string())?;
                }
                None => {}
            }
        }
    }

    Ok(())
}

fn current_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct IrcMessage {
    tags: BTreeMap<String, String>,
    prefix: Option<String>,
    command: String,
    params: Vec<String>,
    trailing: Option<String>,
}

pub fn parse_irc_tags(raw: &str) -> BTreeMap<String, String> {
    let tag_text = raw
        .strip_prefix('@')
        .unwrap_or(raw)
        .split_once(' ')
        .map(|(tags, _)| tags)
        .unwrap_or_else(|| raw.strip_prefix('@').unwrap_or(raw));

    tag_text
        .split(';')
        .filter(|tag| !tag.is_empty())
        .map(|tag| {
            let (key, value) = tag.split_once('=').unwrap_or((tag, ""));
            (key.to_string(), unescape_irc_tag_value(value))
        })
        .collect()
}

pub fn parse_irc_line(raw: &str, channel_id: &str) -> Option<TwitchIrcEvent> {
    let parsed = parse_message(raw)?;

    match parsed.command.as_str() {
        "PRIVMSG" => parse_privmsg(raw, channel_id, &parsed).map(TwitchIrcEvent::Message),
        "CLEARMSG" | "CLEARCHAT" => Some(TwitchIrcEvent::Delete(parse_delete_event(
            channel_id, &parsed,
        ))),
        _ => None,
    }
}

fn parse_message(raw: &str) -> Option<IrcMessage> {
    let mut rest = raw.trim();
    let mut tags = BTreeMap::new();

    if let Some(after_at) = rest.strip_prefix('@') {
        let (tag_text, remainder) = after_at.split_once(' ')?;
        tags = parse_irc_tags(tag_text);
        rest = remainder;
    }

    let mut prefix = None;
    if let Some(after_colon) = rest.strip_prefix(':') {
        let (prefix_text, remainder) = after_colon.split_once(' ')?;
        prefix = Some(prefix_text.to_string());
        rest = remainder;
    }

    let (before_trailing, trailing) = match rest.split_once(" :") {
        Some((before, after)) => (before, Some(after.to_string())),
        None => (rest, None),
    };

    let mut tokens = before_trailing.split_whitespace();
    let command = tokens.next()?.to_string();
    let params = tokens.map(ToString::to_string).collect();

    Some(IrcMessage {
        tags,
        prefix,
        command,
        params,
        trailing,
    })
}

fn parse_privmsg(raw: &str, channel_id: &str, parsed: &IrcMessage) -> Option<NormalizedMessage> {
    let body = parsed.trailing.clone().unwrap_or_default();
    let (is_action, content) = normalize_message_body(&body);
    let author_name = parsed
        .prefix
        .as_deref()
        .and_then(|prefix| prefix.split_once('!').map(|(name, _)| name))
        .unwrap_or_default()
        .to_string();
    let author_display_name = tag_value(&parsed.tags, "display-name")
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| author_name.clone());
    let author_id = tag_value(&parsed.tags, "user-id").unwrap_or_else(|| author_name.clone());
    let channel_display_name = parsed
        .params
        .first()
        .map(|channel| channel.trim_start_matches('#').to_string())
        .unwrap_or_default();
    let timestamp = tag_value(&parsed.tags, "tmi-sent-ts")
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or_default();
    let message_type = if is_action {
        MessageType::Action
    } else {
        MessageType::Chat
    };

    Some(NormalizedMessage {
        id: tag_value(&parsed.tags, "id").unwrap_or_default(),
        platform: Platform::Twitch,
        channel_id: channel_id.to_string(),
        channel_display_name,
        author_id,
        author_name,
        author_display_name,
        author_color: tag_value(&parsed.tags, "color").filter(|color| !color.is_empty()),
        parts: vec![MessagePart::Text { content }],
        badges: parse_badges(&parsed.tags),
        message_type,
        is_highlighted: false,
        is_mention: false,
        is_action,
        is_deleted: false,
        timestamp,
        raw: raw.to_string(),
        reply_to: parse_reply_context(&parsed.tags),
        custom_reward_id: tag_value(&parsed.tags, "custom-reward-id"),
        reward_title: None,
        is_historical: None,
    })
}

fn parse_delete_event(channel_id: &str, parsed: &IrcMessage) -> DeleteMessageEvent {
    let message_id = tag_value(&parsed.tags, "target-msg-id");
    let author_id = tag_value(&parsed.tags, "target-user-id")
        .or_else(|| tag_value(&parsed.tags, "login"))
        .or_else(|| parsed.trailing.clone().filter(|value| !value.is_empty()));

    DeleteMessageEvent {
        channel_id: channel_id.to_string(),
        message_id,
        author_id,
    }
}

fn parse_badges(tags: &BTreeMap<String, String>) -> Vec<BadgeInfo> {
    tag_value(tags, "badges")
        .unwrap_or_default()
        .split(',')
        .filter(|badge| !badge.is_empty())
        .map(|badge| {
            let (id, version) = badge.split_once('/').unwrap_or((badge, ""));
            BadgeInfo {
                id: id.to_string(),
                version: version.to_string(),
                title: id.to_string(),
                image_url: String::new(),
            }
        })
        .collect()
}

fn parse_reply_context(tags: &BTreeMap<String, String>) -> Option<ReplyContext> {
    Some(ReplyContext {
        msg_id: tag_value(tags, "reply-parent-msg-id")?,
        user_login: tag_value(tags, "reply-parent-user-login").unwrap_or_default(),
        user_display_name: tag_value(tags, "reply-parent-display-name").unwrap_or_default(),
        msg_body: tag_value(tags, "reply-parent-msg-body").unwrap_or_default(),
    })
}

fn normalize_message_body(body: &str) -> (bool, String) {
    let Some(action) = body
        .strip_prefix("\u{0001}ACTION ")
        .and_then(|value| value.strip_suffix('\u{0001}'))
    else {
        return (false, body.to_string());
    };

    (true, action.to_string())
}

fn tag_value(tags: &BTreeMap<String, String>, key: &str) -> Option<String> {
    tags.get(key).cloned()
}

fn unescape_irc_tag_value(value: &str) -> String {
    let mut unescaped = String::with_capacity(value.len());
    let mut chars = value.chars();

    while let Some(char) = chars.next() {
        if char != '\\' {
            unescaped.push(char);
            continue;
        }

        match chars.next() {
            Some('s') => unescaped.push(' '),
            Some(':') => unescaped.push(';'),
            Some('r') => unescaped.push('\r'),
            Some('n') => unescaped.push('\n'),
            Some('\\') => unescaped.push('\\'),
            Some(other) => {
                unescaped.push('\\');
                unescaped.push(other);
            }
            None => unescaped.push('\\'),
        }
    }

    unescaped
}

#[cfg(test)]
mod tests {
    use super::{parse_irc_line, parse_irc_tags, TwitchIrcEvent};
    use crate::models::{MessagePart, MessageType, Platform};

    #[test]
    fn twitch_parse_irc_tags_unescapes_values() {
        let tags = parse_irc_tags(
            "@display-name=Display\\sName;color=#9146FF;reply-parent-msg-body=hello\\sworld\\:\\r\\n\\\\;empty=",
        );

        assert_eq!(tags.get("display-name"), Some(&"Display Name".to_string()));
        assert_eq!(tags.get("color"), Some(&"#9146FF".to_string()));
        assert_eq!(
            tags.get("reply-parent-msg-body"),
            Some(&"hello world;\r\n\\".to_string())
        );
        assert_eq!(tags.get("empty"), Some(&String::new()));
    }

    #[test]
    fn twitch_parse_privmsg_normalizes_chat_message() {
        let line = "@badge-info=subscriber/12;badges=broadcaster/1,subscriber/12;color=#9146FF;display-name=AntiSnipe;id=msg-1;tmi-sent-ts=1717000000123;user-id=user-1 :antisnipe!antisnipe@antisnipe.tmi.twitch.tv PRIVMSG #coolchan :Hello chat";

        let event = parse_irc_line(line, "channel-123").expect("PRIVMSG should parse");
        let TwitchIrcEvent::Message(message) = event else {
            panic!("expected normalized message");
        };

        assert_eq!(message.id, "msg-1");
        assert_eq!(message.platform, Platform::Twitch);
        assert_eq!(message.channel_id, "channel-123");
        assert_eq!(message.channel_display_name, "coolchan");
        assert_eq!(message.author_id, "user-1");
        assert_eq!(message.author_name, "antisnipe");
        assert_eq!(message.author_display_name, "AntiSnipe");
        assert_eq!(message.author_color.as_deref(), Some("#9146FF"));
        assert_eq!(
            message.parts,
            vec![MessagePart::Text {
                content: "Hello chat".to_string()
            }]
        );
        assert_eq!(message.badges.len(), 2);
        assert_eq!(message.badges[0].id, "broadcaster");
        assert_eq!(message.badges[0].version, "1");
        assert_eq!(message.badges[1].id, "subscriber");
        assert_eq!(message.badges[1].version, "12");
        assert_eq!(message.message_type, MessageType::Chat);
        assert!(!message.is_action);
        assert!(!message.is_deleted);
        assert_eq!(message.timestamp, 1_717_000_000_123);
        assert_eq!(message.raw, line);
        assert!(message.reply_to.is_none());
    }

    #[test]
    fn twitch_parse_action_message_marks_me_action() {
        let line = "@badges=moderator/1;color=#00FF7F;display-name=ModUser;id=action-1;tmi-sent-ts=1717000000456;user-id=mod-1 :moduser!moduser@moduser.tmi.twitch.tv PRIVMSG #coolchan :\u{0001}ACTION waves hello\u{0001}";

        let event = parse_irc_line(line, "channel-123").expect("ACTION should parse");
        let TwitchIrcEvent::Message(message) = event else {
            panic!("expected normalized message");
        };

        assert_eq!(message.message_type, MessageType::Action);
        assert!(message.is_action);
        assert_eq!(
            message.parts,
            vec![MessagePart::Text {
                content: "waves hello".to_string()
            }]
        );
    }

    #[test]
    fn twitch_parse_reply_tags_adds_reply_context() {
        let line = "@badges=;color=;display-name=ReplyUser;id=reply-1;reply-parent-msg-body=Original\\smessage;reply-parent-msg-id=parent-1;reply-parent-user-login=originaluser;reply-parent-display-name=OriginalUser;tmi-sent-ts=1717000000789;user-id=reply-user :replyuser!replyuser@replyuser.tmi.twitch.tv PRIVMSG #coolchan :replying";

        let event = parse_irc_line(line, "channel-123").expect("reply should parse");
        let TwitchIrcEvent::Message(message) = event else {
            panic!("expected normalized message");
        };
        let reply_to = message.reply_to.expect("reply context should exist");

        assert_eq!(reply_to.msg_id, "parent-1");
        assert_eq!(reply_to.user_login, "originaluser");
        assert_eq!(reply_to.user_display_name, "OriginalUser");
        assert_eq!(reply_to.msg_body, "Original message");
    }

    #[test]
    fn twitch_parse_clearmsg_creates_delete_event_for_message() {
        let line = "@login=baduser;target-msg-id=deleted-msg;tmi-sent-ts=1717000000999 :tmi.twitch.tv CLEARMSG #coolchan :removed message";

        let event = parse_irc_line(line, "channel-123").expect("CLEARMSG should parse");
        let TwitchIrcEvent::Delete(delete) = event else {
            panic!("expected delete event");
        };

        assert_eq!(delete.channel_id, "channel-123");
        assert_eq!(delete.message_id.as_deref(), Some("deleted-msg"));
        assert_eq!(delete.author_id.as_deref(), Some("baduser"));
    }

    #[test]
    fn twitch_parse_clearchat_creates_delete_event_for_user() {
        let line =
            "@target-user-id=user-2;tmi-sent-ts=1717000001111 :tmi.twitch.tv CLEARCHAT #coolchan :baduser";

        let event = parse_irc_line(line, "channel-123").expect("CLEARCHAT should parse");
        let TwitchIrcEvent::Delete(delete) = event else {
            panic!("expected delete event");
        };

        assert_eq!(delete.channel_id, "channel-123");
        assert_eq!(delete.message_id, None);
        assert_eq!(delete.author_id.as_deref(), Some("user-2"));
    }
}
