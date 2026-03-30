import styles from '../../styles/chat.module.css'
import type { BadgeInfo } from '@shared/types/message'

interface BadgeListProps {
  badges: BadgeInfo[]
}

export default function BadgeList({ badges }: BadgeListProps) {
  if (!badges.length) return null

  return (
    <span className={styles.badgeList}>
      {badges.map((badge, i) =>
        badge.imageUrl ? (
          <img
            key={`${badge.id}-${i}`}
            src={badge.imageUrl}
            alt={badge.title}
            title={badge.title}
            className={styles.badge}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span
            key={`${badge.id}-${i}`}
            title={badge.title}
            className="text-xs px-0.5 rounded font-medium"
            style={{ background: 'var(--surface-4)', color: 'var(--text-secondary)', fontSize: '9px' }}
          >
            {badge.id === 'moderator' ? 'MOD' : badge.id === 'owner' ? 'OWN' : badge.title.slice(0, 3).toUpperCase()}
          </span>
        )
      )}
    </span>
  )
}
