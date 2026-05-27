import { format } from 'date-fns'

export default function BuildInfoPanel() {
  const buildDate = format(new Date(__BUILD_DATE__), 'd MMM yyyy HH:mm')

  return (
    <div className="glass-panel build-info-panel">
      <div className="build-info-version">v{__APP_VERSION__}</div>
      <div className="build-info-meta">{buildDate}</div>
    </div>
  )
}
