// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import BuildInfoPanel from './BuildInfoPanel'

describe('BuildInfoPanel', () => {
  it('renders the panel with glass-panel class', () => {
    const { container } = render(<BuildInfoPanel />)
    expect(container.querySelector('.build-info-panel')).toBeTruthy()
    expect(container.querySelector('.glass-panel')).toBeTruthy()
  })

  it('renders version with a v prefix', () => {
    const { container } = render(<BuildInfoPanel />)
    const version = container.querySelector('.build-info-version')
    expect(version?.textContent).toMatch(/^v\d+\.\d+\.\d+/)
  })

  it('renders a formatted build date', () => {
    const { container } = render(<BuildInfoPanel />)
    const metas = container.querySelectorAll('.build-info-meta')
    // First meta line: date formatted as "D MMM YYYY HH:mm"
    expect(metas[0]?.textContent).toMatch(/\d+ \w+ \d{4} \d{2}:\d{2}/)
  })

})
