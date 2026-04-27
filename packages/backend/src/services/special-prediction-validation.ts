import type { SpecialTypeInput } from '../types/index.js'

export class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export const VALID_INPUT_TYPES = new Set(['text', 'dropdown', 'team_select'])

export function validateSpecialTypeInput(input: SpecialTypeInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new AppError(400, 'name is required')
  }
  if (input.name.length > 100) {
    throw new AppError(400, 'name must be at most 100 characters')
  }
  if (!VALID_INPUT_TYPES.has(input.inputType)) {
    throw new AppError(400, "inputType must be 'text', 'dropdown', or 'team_select'")
  }
  if (input.inputType === 'dropdown') {
    if (!Array.isArray(input.options) || input.options.length < 2) {
      throw new AppError(400, 'dropdown type requires at least 2 options')
    }
    if (input.options.length > 20) {
      throw new AppError(400, 'dropdown type allows at most 20 options')
    }
    for (const opt of input.options) {
      if (typeof opt !== 'string' || opt.length > 100) {
        throw new AppError(400, 'each option must be a string of at most 100 characters')
      }
    }
  }
  if (typeof input.points !== 'number' || input.points < 1 || input.points > 100) {
    throw new AppError(400, 'points must be an integer between 1 and 100')
  }
  if (!input.deadline) {
    throw new AppError(400, 'deadline is required')
  }
}
