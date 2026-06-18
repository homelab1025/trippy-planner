// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthHeader } from './AuthHeader'

describe('AuthHeader', () => {
  beforeEach(() => cleanup())
  it('shows nothing when user is null', () => {
    const { container } = render(<AuthHeader user={null} onSignOut={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows user email when authenticated', () => {
    render(<AuthHeader user={{ id: 1, email: 'rider@example.com' }} onSignOut={vi.fn()} />)
    expect(screen.getByText('rider@example.com')).toBeInTheDocument()
  })

  it('calls onSignOut when sign-out is clicked', () => {
    const onSignOut = vi.fn()
    render(<AuthHeader user={{ id: 1, email: 'a@b.com' }} onSignOut={onSignOut} />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
