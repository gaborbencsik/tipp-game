import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import AuthCallbackView from '@/views/AuthCallbackView.vue'
import { mount, flushPromises } from '@vue/test-utils'
import { buildTestRouter } from '@/test-utils/router'

const mockPush = vi.fn().mockResolvedValue(undefined)
const mockReplace = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush, replace: mockReplace }) }
})

const { mockGetSession, mockOnAuthStateChange, mockHandleSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockHandleSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

const authStoreState = {
  pendingInviteCode: null as string | null,
  clearPendingInviteCode: vi.fn(),
}

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: null,
      isAuthenticated: () => false,
      handleSession: mockHandleSession,
      get pendingInviteCode() { return authStoreState.pendingInviteCode },
      clearPendingInviteCode: authStoreState.clearPendingInviteCode,
    }),
  }
})

const mockJoinGroup = vi.fn()
vi.mock('@/stores/groups.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/groups.store')>()
  return {
    ...actual,
    useGroupsStore: () => ({
      joinGroup: mockJoinGroup,
    }),
  }
})

function buildRouter() {
  return buildTestRouter({ '/auth/callback': AuthCallbackView })
}

describe('AuthCallbackView', () => {
  beforeEach(() => {
    mockPush.mockReset().mockResolvedValue(undefined)
    mockReplace.mockReset().mockResolvedValue(undefined)
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockHandleSession.mockReset().mockResolvedValue(undefined)
    mockJoinGroup.mockReset()
    authStoreState.pendingInviteCode = null
    authStoreState.clearPendingInviteCode = vi.fn()
    setActivePinia(createPinia())
  })

  it('onAuthStateChange with session, no pending invite → handleSession called, navigates /', async () => {
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockHandleSession).toHaveBeenCalledWith(mockSession)
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('getSession session present (fallback) → handleSession called, navigates /', async () => {
    const mockSession = { access_token: 'tok2', user: { id: 'uid2' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
    mockGetSession.mockResolvedValue({ data: { session: mockSession } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockHandleSession).toHaveBeenCalledWith(mockSession)
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('no session → handleSession not called, navigates /', async () => {
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_OUT', null)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockHandleSession).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('pendingInviteCode present + joinGroup success → replace(/app/groups/{id}) and clear', async () => {
    authStoreState.pendingInviteCode = 'ABC123'
    mockJoinGroup.mockResolvedValue({ id: 'group-uuid-1', name: 'Test', inviteCode: 'ABC123' })
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockJoinGroup).toHaveBeenCalledWith({ inviteCode: 'ABC123' })
    expect(authStoreState.clearPendingInviteCode).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/app/groups/group-uuid-1')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('pendingInviteCode present + joinGroup throws "Group not found" → replace with inviteError=notFound', async () => {
    authStoreState.pendingInviteCode = 'BADCODE'
    mockJoinGroup.mockRejectedValue(new Error('Group not found'))
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(authStoreState.clearPendingInviteCode).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith({ path: '/app/groups', query: { inviteError: 'notFound' } })
  })

  it('pendingInviteCode present + joinGroup throws "no longer active" → replace with inviteError=inactive', async () => {
    authStoreState.pendingInviteCode = 'OLD123'
    mockJoinGroup.mockRejectedValue(new Error('Invite code is no longer active'))
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockReplace).toHaveBeenCalledWith({ path: '/app/groups', query: { inviteError: 'inactive' } })
  })

  it('pendingInviteCode present + joinGroup throws "Already a member" → replace with inviteError=alreadyMember', async () => {
    authStoreState.pendingInviteCode = 'EXIST1'
    mockJoinGroup.mockRejectedValue(new Error('Already a member of this group'))
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockReplace).toHaveBeenCalledWith({ path: '/app/groups', query: { inviteError: 'alreadyMember' } })
  })

  it('pendingInviteCode present + joinGroup throws unknown → replace with inviteError=generic', async () => {
    authStoreState.pendingInviteCode = 'WHAT12'
    mockJoinGroup.mockRejectedValue(new Error('Boom'))
    const mockSession = { access_token: 'tok', user: { id: 'uid' } }
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('SIGNED_IN', mockSession)
      return { data: { subscription: { unsubscribe } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    mount(AuthCallbackView, { global: { plugins: [createPinia(), buildRouter()] } })
    await flushPromises()

    expect(mockReplace).toHaveBeenCalledWith({ path: '/app/groups', query: { inviteError: 'generic' } })
  })
})
