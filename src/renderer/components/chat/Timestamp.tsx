import styles from '../../styles/chat.module.css'
import { formatTimestamp } from '../../utils/timeFormat'

export default function Timestamp({ timestamp }: { timestamp: number }) {
  return (
    <span className={styles.timestamp} title={new Date(timestamp).toLocaleString()}>
      {formatTimestamp(timestamp)}
    </span>
  )
}
