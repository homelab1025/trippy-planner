interface Props {
  user: { id: number; email: string } | null
  onSignOut: () => void
}

export function AuthHeader({ user, onSignOut }: Props) {
  if (!user) return null
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-base-content/70">{user.email}</span>
      <button className="btn btn-ghost btn-xs" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
