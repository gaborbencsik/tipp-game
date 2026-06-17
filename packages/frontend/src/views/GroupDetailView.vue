<template>
  <AppLayout>
    <div class="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
      <router-link
        to="/app/groups"
        class="text-blue-600 hover:text-blue-800 inline-flex items-center shrink-0"
        :aria-label="$t('groupDetail.backToGroups')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </router-link>
      <div class="min-w-0 flex items-center gap-2">
        <h1 class="text-xl md:text-2xl font-bold text-gray-900 truncate">{{ groupName }}</h1>
        <ScoringExplainerTrigger source="group" variant="icon" />
      </div>
    </div>

    <div data-testid="tab-bar" class="flex gap-2 overflow-x-auto mb-4 md:mb-6 px-1 py-1 -mx-1" role="tablist">
      <button
        data-testid="tab-leaderboard"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'leaderboard'"
        class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        :class="activeTab === 'leaderboard'
          ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
        @click="activeTab = 'leaderboard'"
      >
        {{ $t('groupDetail.tabLeaderboard') }}
      </button>
      <button
        data-testid="tab-my-predictions"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'my-predictions'"
        class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        :class="activeTab === 'my-predictions'
          ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
        @click="switchToMyPredictionsTab"
      >
        {{ $t('groupDetail.tabMyTips') }}
      </button>
      <button
        v-if="SHOW_SPECIAL_TIPS"
        data-testid="tab-special"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'special'"
        class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        :class="activeTab === 'special'
          ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
        @click="switchToSpecialTab"
      >
        {{ $t('groupDetail.tabSpecial') }}
      </button>
      <button
        v-if="currentUserIsGroupAdmin"
        data-testid="tab-members"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'members'"
        class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        :class="activeTab === 'members'
          ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
        @click="activeTab = 'members'"
      >
        {{ $t('groupDetail.tabMembers') }}
      </button>
      <button
        v-if="canManageSettings"
        data-testid="tab-settings"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'settings'"
        class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        :class="activeTab === 'settings'
          ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
        @click="activeTab = 'settings'"
      >
        {{ $t('groupDetail.tabSettings') }}
      </button>
    </div>

    <!-- Ranglista tab -->
    <div v-if="activeTab === 'leaderboard'">
      <div v-if="isLoading" class="text-gray-500">{{ $t('common.loading') }}</div>
      <div v-else-if="error" class="text-red-600">{{ error }}</div>
      <div v-else-if="entries.length === 0" class="text-gray-500">{{ $t('leaderboard.empty') }}</div>
      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="hidden md:table-header-group">
            <tr class="border-b border-gray-200 text-gray-500 text-left">
              <th class="pl-4 pr-2 py-3 w-10">{{ $t('groupDetail.rank') }}</th>
              <th class="px-2 py-3">{{ $t('groupDetail.player') }}</th>
              <th class="py-3 text-right" style="min-width:6rem;padding-left:0.5rem;padding-right:0.75rem">{{ $t('groupDetail.tips') }}</th>
              <th class="py-3 text-right" style="min-width:5rem;padding-left:0.5rem;padding-right:0.75rem">{{ $t('groupDetail.correct') }}</th>
              <th v-if="SHOW_SPECIAL_TIPS" class="py-3 text-right" style="min-width:4.5rem;padding-left:0.5rem;padding-right:0.75rem" :title="$t('groupDetail.specialPointsTitle')">{{ $t('groupDetail.specialPoints') }}</th>
              <th class="py-3 text-right font-semibold" style="min-width:4rem;padding-left:0.5rem;padding-right:1rem">{{ $t('groupDetail.totalPoints') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.userId"
              class="border-b border-gray-100 last:border-0 transition-colors"
              :class="entry.userId === authStore.user?.id ? 'bg-blue-50' : 'hover:bg-gray-50'"
            >
              <td class="pl-2 md:pl-4 pr-1 md:pr-2 py-2 md:py-3 text-gray-400 font-medium">{{ entry.rank }}</td>
              <td class="px-1 md:px-2 py-2 md:py-3">
                <div class="flex items-center gap-1.5 md:gap-2 min-w-0">
                  <span
                    v-if="entry.favoriteTeam?.countryCode"
                    :class="`fi fi-${entry.favoriteTeam.countryCode}`"
                    :title="entry.favoriteTeam.name"
                    class="shrink-0"
                    style="width:1.2em;height:0.9em"
                  />
                  <img
                    :src="entry.avatarUrl ?? dicebearUrl(entry.displayName)"
                    :alt="entry.displayName"
                    class="w-6 h-6 md:w-7 md:h-7 rounded-full object-cover shrink-0"
                  />
                  <span class="font-medium text-gray-800 truncate">{{ entry.displayName }}</span>
                  <span
                    v-if="entry.isPaid"
                    data-testid="leaderboard-paid-badge"
                    aria-label="Paid"
                    class="shrink-0 inline-flex items-center justify-center bg-amber-50 ring-1 ring-amber-200 rounded-full w-5 h-5 md:w-6 md:h-6 text-xs md:text-sm leading-none"
                  >💰</span>
                  <SupporterBadge
                    v-if="entry.isSupporter"
                    responsive
                    testid="leaderboard-supporter-badge"
                  />
                  <span v-if="entry.userId === authStore.user?.id" class="text-[0.65rem] md:text-xs text-blue-600 shrink-0">{{ $t('groupDetail.you') }}</span>
                </div>
              </td>
              <td class="px-1 md:px-4 py-2 md:py-3 text-right text-gray-600 tabular-nums">{{ entry.predictionCount }}</td>
              <td class="px-1 md:px-4 py-2 md:py-3 text-right text-gray-600 tabular-nums">{{ entry.correctCount }}</td>
              <td v-if="SHOW_SPECIAL_TIPS" class="px-1 md:px-4 py-2 md:py-3 text-right text-gray-500 tabular-nums">{{ entry.specialPredictionPoints ?? 0 }}</td>
              <td class="pl-1 pr-2 md:px-4 py-2 md:py-3 text-right font-bold text-blue-700 tabular-nums">{{ entry.totalPoints }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tagok tab -->
    <div v-else-if="activeTab === 'members'" data-testid="members-tab">
      <div v-if="groupsStore.membersLoading" data-testid="members-spinner" class="text-gray-500">{{ $t('common.loading') }}</div>
      <div v-else-if="groupsStore.membersError" class="text-red-600">{{ groupsStore.membersError }}</div>
      <div v-else class="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-gray-500 text-left">
              <th class="px-4 py-3">{{ $t('groupDetail.memberCol') }}</th>
              <th class="px-4 py-3">{{ $t('groupDetail.roleCol') }}</th>
              <th class="px-4 py-3 hidden md:table-cell">{{ $t('groupDetail.joinedCol') }}</th>
              <th v-if="currentUserIsGroupAdmin || isGlobalAdmin" class="px-4 py-3">{{ $t('groupDetail.actionsCol') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in members"
              :key="member.id"
              data-testid="member-row"
              class="border-b border-gray-100 last:border-0"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <img
                    :src="member.avatarUrl ?? dicebearUrl(member.displayName)"
                    :alt="member.displayName"
                    class="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <span class="font-medium text-gray-800">{{ member.displayName }}</span>
                  <span
                    v-if="member.isPaid"
                    data-testid="member-paid-badge"
                    aria-label="Paid"
                    class="inline-flex items-center justify-center bg-amber-50 ring-1 ring-amber-200 rounded-full w-6 h-6 text-sm leading-none"
                  >💰</span>
                  <SupporterBadge
                    v-if="member.isSupporter"
                    size="sm"
                    testid="member-supporter-badge"
                  />
                  <span v-if="member.userId === authStore.user?.id" class="text-xs text-blue-600">{{ $t('groupDetail.you') }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="member.isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ member.isAdmin ? $t('groupDetail.roleAdmin') : $t('groupDetail.roleUser') }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm hidden md:table-cell">{{ formatDate(member.joinedAt) }}</td>
              <td v-if="currentUserIsGroupAdmin || isGlobalAdmin" class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="currentUserIsGroupAdmin"
                    :disabled="member.userId === authStore.user?.id"
                    class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="onToggleAdmin(member)"
                  >
                    {{ member.isAdmin ? $t('groupDetail.demoteAdmin') : $t('groupDetail.promoteAdmin') }}
                  </button>
                  <button
                    v-if="currentUserIsGroupAdmin"
                    :disabled="member.userId === authStore.user?.id"
                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="confirmRemoveUserId = member.userId"
                  >
                    {{ $t('groupDetail.removeMember') }}
                  </button>
                  <button
                    v-if="isGlobalAdmin"
                    :data-testid="`paid-toggle-${member.userId}`"
                    class="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                    @click="onTogglePaid(member)"
                  >
                    {{ member.isPaid ? $t('groupDetail.memberPaidToggleOff') : $t('groupDetail.memberPaidToggleOn') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Beállítások tab -->
    <div v-if="activeTab === 'settings'" data-testid="settings-tab">
      <!-- Invite section (admin only) -->
      <div v-if="currentUserIsGroupAdmin" data-testid="invite-section" class="mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">{{ $t('groupDetail.inviteTitle') }}</h3>
        <div class="flex items-center gap-2 mb-3">
          <span data-testid="invite-code-display" class="font-mono text-lg font-bold tracking-widest text-gray-900">{{ currentGroup?.inviteCode }}</span>
          <button
            class="text-xs px-2 py-1 rounded border transition-all duration-200"
            :class="copiedInvite === 'code' ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'"
            @click="copyInviteCode"
          >
            {{ copiedInvite === 'code' ? $t('common.copied') : $t('common.code') }}
          </button>
          <button
            class="text-xs px-2 py-1 rounded border transition-all duration-200"
            :class="copiedInvite === 'url' ? 'border-green-400 bg-green-50 text-green-600' : 'border-blue-300 text-blue-600 hover:border-blue-400'"
            @click="copyInviteUrl"
          >
            {{ copiedInvite === 'url' ? $t('common.copied') : $t('common.copyLink') }}
          </button>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">
            {{ $t('groupDetail.inviteStatus') }} <span :class="currentGroup?.inviteActive ? 'text-green-600' : 'text-red-500'">{{ currentGroup?.inviteActive ? $t('common.active') : $t('common.inactive') }}</span>
          </span>
          <button
            data-testid="invite-toggle-btn"
            class="text-xs px-2 py-1 rounded border"
            :class="currentGroup?.inviteActive ? 'border-red-300 text-red-600' : 'border-green-300 text-green-600'"
            @click="onToggleInvite"
          >
            {{ currentGroup?.inviteActive ? $t('groupDetail.inviteDeactivate') : $t('groupDetail.inviteActivate') }}
          </button>
          <button
            data-testid="invite-regenerate-btn"
            class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600"
            @click="showInviteConfirm = true"
          >
            {{ $t('groupDetail.inviteRegenerate') }}
          </button>
        </div>
      </div>

      <!-- Csoport törlése (admin only) -->
      <div v-if="currentUserIsGroupAdmin" class="mb-6">
        <button
          data-testid="delete-group-btn"
          class="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          @click="showDeleteConfirm = true"
        >
          {{ $t('groupDetail.deleteGroupBtn') }}
        </button>
      </div>
      <div v-if="groupsStore.groupScoringLoading" class="text-gray-500">{{ $t('common.loading') }}</div>
      <div v-else-if="groupsStore.groupScoringError" class="text-red-600">{{ groupsStore.groupScoringError }}</div>
      <div v-else class="max-w-md">
        <h3 class="text-base font-semibold text-gray-800 mb-1">{{ $t('groupDetail.scoringTitle') }}</h3>
        <p class="text-sm text-gray-500 mb-4">{{ $t('groupDetail.scoringDesc') }}</p>
        <div
          v-if="isGroupScoringFrozen"
          data-testid="settings-frozen-banner"
          class="mb-4 p-3 bg-amber-100 text-amber-800 border border-amber-300 rounded text-sm"
        >
          A pontrendszer zárolt — már érkeztek tippek erre a konfigurációra. Csak felülírással módosítható.
        </div>
        <form class="space-y-3" @submit.prevent="submitScoringConfig">
          <div v-for="field in scoringFields" :key="field.key" class="flex items-center justify-between gap-4">
            <label class="text-sm font-medium text-gray-700">{{ field.label }}</label>
            <input
              v-model.number="scoringDraft[field.key]"
              :data-testid="`settings-field-${field.key}`"
              type="number"
              min="0"
              max="10"
              required
              :disabled="isGroupScoringFrozen"
              class="w-20 border rounded px-2 py-1 text-center disabled:bg-gray-100"
            />
          </div>
          <div class="flex items-center gap-4 pt-2">
            <button
              v-if="!isGroupScoringFrozen"
              type="submit"
              data-testid="settings-submit"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              :disabled="groupsStore.groupScoringSaveStatus === 'saving'"
            >
              {{ $t('common.save') }}
            </button>
            <button
              v-if="isGroupScoringFrozen && canManageSettings"
              type="button"
              data-testid="settings-override-btn"
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              @click="overrideScoringOpen = true"
            >
              Felülírás
            </button>
            <span
              v-if="groupsStore.groupScoringSaveStatus === 'saved'"
              data-testid="settings-save-status"
              class="text-sm text-green-600"
            >
              {{ $t('common.saved') }}
            </span>
            <span
              v-else-if="groupsStore.groupScoringSaveStatus === 'error'"
              data-testid="settings-save-status"
              class="text-sm text-red-600"
            >
              {{ $t('groupDetail.leagueSaveError') }}
            </span>
          </div>
        </form>
        <ScoringOverrideModal
          v-if="overrideScoringOpen"
          title="Csoport pontrendszer felülírása"
          warning="A csoport pontrendszere zárolt. A felülírás új értékekkel írja felül és (opcionálisan) újraszámolja a pontokat."
          :affected-matches="groupsStore.groupScoringConfigs[groupId]?.affectedMatches"
          :affected-predictions="groupsStore.groupScoringConfigs[groupId]?.affectedPredictions"
          @cancel="overrideScoringOpen = false"
          @confirm="onScoringOverrideConfirm"
        />
      </div>

      <!-- Kedvenc csapat dupla pont toggle -->
      <div class="mt-8 max-w-md">
        <h3 class="text-base font-semibold text-gray-800 mb-1">{{ $t('groupDetail.favTitle') }}</h3>
        <p class="text-sm text-gray-500 mb-3">{{ $t('groupDetail.favDesc') }}</p>
        <div class="flex items-center justify-between border rounded-lg p-3 bg-white">
          <span class="text-sm font-medium text-gray-800">{{ $t('groupDetail.favRule') }}</span>
          <label class="inline-flex items-center gap-2 shrink-0 cursor-pointer">
            <button
              type="button"
              role="switch"
              data-testid="fav-double-toggle"
              :aria-checked="currentGroup?.favoriteTeamDoublePoints"
              class="relative w-9 h-5 rounded-full transition-colors duration-150"
              :class="currentGroup?.favoriteTeamDoublePoints ? 'bg-green-500' : 'bg-gray-300'"
              @click="toggleFavDoublePoints"
            >
              <span
                class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150"
                :class="currentGroup?.favoriteTeamDoublePoints ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
            <span class="text-xs font-medium" :class="currentGroup?.favoriteTeamDoublePoints ? 'text-green-700' : 'text-gray-400'">
              {{ currentGroup?.favoriteTeamDoublePoints ? $t('common.active') : $t('common.inactive') }}
            </span>
          </label>
        </div>
      </div>

      <!-- Liga szűrő -->
      <div class="mt-8 max-w-md">
        <h3 class="text-base font-semibold text-gray-800 mb-1">{{ $t('groupDetail.leagueTitle') }}</h3>
        <p class="text-sm text-gray-500 mb-3">{{ $t('groupDetail.leagueDesc') }}</p>
        <template v-if="currentGroup?.league">
          <p class="text-sm text-gray-900">{{ currentGroup.league.name }}</p>
        </template>
        <template v-else>
          <select
            v-model="leagueDraft"
            :class="[
              'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              !leagueDraft ? 'text-gray-400' : 'text-gray-900'
            ]"
          >
            <option value="" disabled>{{ $t('groups.leaguePlaceholder') }}</option>
            <option v-for="league in leagueStore.leagues" :key="league.id" :value="league.id">
              {{ league.name }}
            </option>
          </select>
          <div class="flex items-center gap-4 mt-3">
            <button
              type="button"
              data-testid="leagues-submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              :disabled="leagueSaveStatus === 'saving' || !leagueDraft"
              @click="submitLeagues"
            >
              {{ $t('common.save') }}
            </button>
            <span v-if="leagueSaveStatus === 'saved'" class="text-sm text-green-600">{{ $t('common.saved') }}</span>
            <span v-else-if="leagueSaveStatus === 'error'" class="text-sm text-red-600">{{ $t('groupDetail.leagueSaveError') }}</span>
          </div>
        </template>
      </div>

      <!-- Hivatalos speciális tippek kezelése (admin) -->
      <div v-if="SHOW_SPECIAL_TIPS" class="mt-8 max-w-lg">
        <h3 class="text-base font-semibold text-gray-800 mb-1">{{ $t('groupDetail.globalTypesTitle') }}</h3>
        <p class="text-sm text-gray-500 mb-4">{{ $t('groupDetail.globalTypesDesc') }}</p>

        <div v-if="groupsStore.globalSubscriptionsLoading" class="text-gray-500 text-sm">{{ $t('common.loading') }}</div>
        <div v-else-if="groupsStore.globalSubscriptionsError" class="text-red-600 text-sm">{{ groupsStore.globalSubscriptionsError }}</div>
        <div v-else-if="globalSubscriptions.length === 0" class="text-sm text-gray-400">{{ $t('groupDetail.globalTypesEmpty') }}</div>
        <div v-else class="space-y-2">
          <div
            v-for="gt in globalSubscriptions"
            :key="gt.id"
            class="flex items-center justify-between border rounded-lg p-3 bg-white"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-800 text-sm">{{ gt.name }}</p>
              <p v-if="gt.description" class="text-xs text-gray-500 mt-0.5">{{ gt.description }}</p>
              <div class="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                <span>{{ $t('groupDetail.pointsFormat', { n: gt.points }) }}</span>
                <span>·</span>
                <span>{{ $t('groupDetail.deadlineFormat', { date: formatDateTime(gt.deadline) }) }}</span>
              </div>
            </div>
            <label class="inline-flex items-center gap-2 shrink-0 cursor-pointer" :class="{ 'opacity-50 pointer-events-none': subscriptionToggling[gt.id] }">
              <button
                type="button"
                role="switch"
                :aria-checked="gt.subscribed"
                class="relative w-9 h-5 rounded-full transition-colors duration-150"
                :class="gt.subscribed ? 'bg-green-500' : 'bg-gray-300'"
                @click="toggleGlobalSubscription(gt)"
              >
                <span
                  class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150"
                  :class="gt.subscribed ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <span class="text-xs font-medium" :class="gt.subscribed ? 'text-green-700' : 'text-gray-400'">
                {{ gt.subscribed ? $t('groupDetail.subscriptionActive') : $t('groupDetail.subscriptionInactive') }}
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Egyedi speciális tipp típusok kezelése (admin) -->
      <div v-if="SHOW_SPECIAL_TIPS" class="mt-8 max-w-lg">
        <h3 class="text-base font-semibold text-gray-800 mb-1">{{ $t('groupDetail.customTypesTitle') }}</h3>
        <p class="text-sm text-gray-500 mb-4">{{ $t('groupDetail.customTypesDesc') }}</p>

        <div v-if="groupsStore.specialTypesLoading" class="text-gray-500 text-sm">{{ $t('common.loading') }}</div>
        <div v-else-if="groupsStore.specialTypesError" class="text-red-600 text-sm">{{ groupsStore.specialTypesError }}</div>
        <div v-else>
          <!-- Existing types list -->
          <div v-if="specialTypes.length > 0" class="space-y-3 mb-4">
            <div
              v-for="st in specialTypes"
              :key="st.id"
              class="border rounded-lg p-3 bg-white"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-gray-800 text-sm">{{ st.name }}</p>
                  <p v-if="st.description" class="text-xs text-gray-500 mt-0.5">{{ st.description }}</p>
                  <div class="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                    <span>{{ st.inputType === 'dropdown' ? $t('groupDetail.typeKindDropdown') : st.inputType === 'team_select' ? $t('groupDetail.typeKindTeam') : st.inputType === 'player_select' ? $t('groupDetail.typeKindPlayer') : $t('groupDetail.typeKindFreeText') }}</span>
                    <span>·</span>
                    <span>{{ $t('groupDetail.pointsFormat', { n: st.points }) }}</span>
                    <span>·</span>
                    <span>{{ $t('groupDetail.deadlineFormat', { date: formatDateTime(st.deadline) }) }}</span>
                  </div>
                  <div v-if="Array.isArray(st.options) && st.options.length" class="mt-1 text-xs text-gray-400">
                    {{ $t('groupDetail.optionsFormat', { options: st.options.join(', ') }) }}
                  </div>
                  <div v-if="st.correctAnswer" class="mt-1 text-xs text-green-600 font-medium">
                    {{ $t('groupDetail.correctAnswer', { answer: resolveAnswerLabel(st.inputType, st.correctAnswer) }) }}
                  </div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button
                    v-if="!st.correctAnswer"
                    class="text-xs px-2 py-1 rounded border border-green-300 text-green-600 hover:bg-green-50"
                    @click="openSetAnswer(st)"
                  >
                    {{ $t('groupDetail.typeEvaluate') }}
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
                    @click="openEditType(st)"
                  >
                    {{ $t('common.edit') }}
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                    @click="confirmDeactivateTypeId = st.id"
                  >
                    {{ $t('common.delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-400 mb-4">{{ $t('groupDetail.customTypesEmpty') }}</div>

          <!-- Template picker -->
          <div v-if="templates.length > 0 && !showTypeForm" class="mb-4">
            <p class="text-xs font-medium text-gray-600 mb-2">{{ $t('groupDetail.templateLabel') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tpl in templates"
                :key="tpl.id"
                class="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                @click="applyTemplate(tpl)"
              >
                {{ tpl.name }} ({{ tpl.defaultPoints }}p)
              </button>
            </div>
          </div>

          <!-- Create / Edit form -->
          <button
            v-if="!showTypeForm"
            class="text-sm px-3 py-1.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
            @click="openNewTypeForm"
          >
            {{ $t('groupDetail.newCustomType') }}
          </button>

          <form v-if="showTypeForm" class="border rounded-lg p-4 bg-gray-50 space-y-3" @submit.prevent="submitTypeForm">
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">{{ $t('groupDetail.typeNameLabel') }}</label>
              <input v-model="typeDraft.name" type="text" maxlength="100" required class="w-full border rounded px-2 py-1 text-sm" :placeholder="$t('groupDetail.typeNamePlaceholder')" />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">{{ $t('groupDetail.typeDescLabel') }}</label>
              <input v-model="typeDraft.description" type="text" class="w-full border rounded px-2 py-1 text-sm" :placeholder="$t('groupDetail.typeDescPlaceholder')" />
            </div>
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="text-xs font-medium text-gray-600 block mb-1">{{ $t('groupDetail.typeKindLabel') }}</label>
                <select v-model="typeDraft.inputType" class="w-full border rounded px-2 py-1 text-sm">
                  <option value="text">{{ $t('groupDetail.typeKindFreeText') }}</option>
                  <option value="dropdown">{{ $t('groupDetail.typeKindDropdown') }}</option>
                  <option value="team_select">{{ $t('groupDetail.typeKindTeam') }}</option>
                  <option value="player_select">{{ $t('groupDetail.typeKindPlayer') }}</option>
                </select>
              </div>
              <div class="w-24">
                <label class="text-xs font-medium text-gray-600 block mb-1">{{ $t('groupDetail.typePointsLabel') }}</label>
                <input v-model.number="typeDraft.points" type="number" min="1" max="100" required class="w-full border rounded px-2 py-1 text-sm text-center" />
              </div>
            </div>
            <div v-if="typeDraft.inputType === 'dropdown'">
              <label class="text-xs font-medium text-gray-600 block mb-1">{{ $t('groupDetail.typeOptionsLabel') }}</label>
              <input v-model="typeDraft.optionsRaw" type="text" class="w-full border rounded px-2 py-1 text-sm" :placeholder="$t('groupDetail.typeOptionsPlaceholder')" />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">{{ $t('groupDetail.typeDeadlineLabel') }}</label>
              <input v-model="typeDraft.deadline" type="datetime-local" required class="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div v-if="typeFormError" class="text-xs text-red-600">{{ typeFormError }}</div>
            <div class="flex gap-2 pt-1">
              <button type="submit" class="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="typeFormSaving">
                {{ editingTypeId ? $t('common.save') : $t('groups.create') }}
              </button>
              <button type="button" class="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600" @click="showTypeForm = false">
                {{ $t('common.cancel') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Tippjeim tab -->
    <div v-if="activeTab === 'my-predictions'" data-testid="my-predictions-tab">
      <!-- Élő tippjeim -->
      <div v-if="virtualPoints.length > 0" data-testid="live-predictions-section" class="mb-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">{{ $t('groupDetail.liveSectionTitle') }}</h2>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500 text-left">
                <th class="px-4 py-3">{{ $t('groupDetail.matchCol') }}</th>
                <th class="px-4 py-3 text-center">{{ $t('groupDetail.tipCol') }}</th>
                <th class="px-4 py-3 text-center">{{ $t('groupDetail.liveScoreCol') }}</th>
                <th class="px-4 py-3 text-right">{{ $t('groupDetail.pointCol') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in virtualPoints"
                :key="entry.matchId"
                data-testid="live-prediction-row"
                class="border-b border-gray-100 last:border-0"
              >
                <td class="px-4 py-3">
                  <div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-2">
                      <span data-testid="live-badge" class="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{{ $t('groupDetail.liveBadge') }}</span>
                      <span v-if="entry.minute !== null" class="text-xs text-gray-500">{{ $t('groupDetail.liveMinute', { n: entry.minute }) }}</span>
                    </div>
                    <span class="font-medium text-gray-800">{{ entry.homeTeam.shortCode }} – {{ entry.awayTeam.shortCode }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-center text-gray-600 font-mono">{{ entry.predHomeGoals }}–{{ entry.predAwayGoals }}</td>
                <td data-testid="live-score" class="px-4 py-3 text-center text-gray-800 font-mono font-semibold">{{ entry.liveHomeScore }}–{{ entry.liveAwayScore }}</td>
                <td class="px-4 py-3 text-right">
                  <span data-testid="virtual-points" class="font-semibold" :class="entry.virtualPoints > 0 ? 'text-blue-700' : 'text-gray-400'">
                    {{ $t('groupDetail.liveVirtualPoints', { n: entry.virtualPoints }) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="groupsStore.myGroupPredictionsLoading" class="text-gray-500">{{ $t('common.loading') }}</div>
      <div v-else-if="groupsStore.myGroupPredictionsError" class="text-red-600">{{ groupsStore.myGroupPredictionsError }}</div>
      <div v-else-if="!myGroupPredictions || myGroupPredictions.predictions.length === 0" data-testid="my-predictions-empty" class="text-gray-500 text-sm">
        <span v-if="virtualPoints.length === 0">{{ $t('groupDetail.myPredEmpty') }}</span>
      </div>
      <div v-else>
        <div class="mb-4 text-sm font-medium text-gray-700">
          {{ $t('groupDetail.myPredTotal') }} <span class="text-blue-700 font-bold">{{ $t('groupDetail.myPredTotalPoints', { n: myGroupPredictions.totalPoints }) }}</span>
        </div>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500 text-left">
                <th class="px-4 py-3">{{ $t('groupDetail.matchCol') }}</th>
                <th class="px-4 py-3 text-center">{{ $t('groupDetail.tipCol') }}</th>
                <th class="px-4 py-3 text-center">{{ $t('groupDetail.resultCol') }}</th>
                <th data-testid="my-pred-match-points-header" class="hidden md:table-cell px-4 py-3 text-right text-gray-400">{{ $t('groupDetail.matchPointCol') }}</th>
                <th data-testid="my-pred-scorer-name-header" class="hidden md:table-cell px-4 py-3 text-center">{{ $t('groupDetail.scorerTipCol') }}</th>
                <th data-testid="my-pred-scorer-points-header" class="hidden md:table-cell px-4 py-3 text-right text-gray-400">{{ $t('groupDetail.scorerPointCol') }}</th>
                <th class="px-4 py-3 text-right">{{ $t('groupDetail.totalPointCol') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="pred in myGroupPredictions.predictions"
                :key="pred.predictionId"
                data-testid="my-prediction-row"
                class="border-b border-gray-100 last:border-0"
                :class="myPredRowClass(pred)"
              >
                <td class="px-4 py-3">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-gray-400">{{ formatDate(pred.scheduledAt) }}</span>
                    <span class="font-medium text-gray-800">{{ pred.homeTeam.shortCode }} – {{ pred.awayTeam.shortCode }}</span>
                  </div>
                </td>
                <td data-testid="my-pred-tip" class="px-4 py-3 text-center font-mono" :class="myPredTipClass(pred)">{{ pred.homeGoals }}–{{ pred.awayGoals }}</td>
                <td class="px-4 py-3 text-center text-gray-700 font-mono">{{ pred.resultHomeGoals }}–{{ pred.resultAwayGoals }}</td>
                <td data-testid="my-pred-match-points" class="hidden md:table-cell px-4 py-3 text-right tabular-nums" :class="pred.matchPoints > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'">
                  <div class="flex items-center justify-end gap-1">
                    <span v-if="pred.doubledByFavorite && pred.matchPoints > 0" data-testid="match-double-badge" class="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">×2</span>
                    <span>{{ pred.matchPoints }}</span>
                  </div>
                </td>
                <td data-testid="my-pred-scorer-name" class="hidden md:table-cell px-4 py-3 text-center font-mono" :class="myPredScorerNameClass(pred)">{{ pred.scorerPickPlayerName ?? '—' }}</td>
                <td data-testid="my-pred-scorer-points" class="hidden md:table-cell px-4 py-3 text-right tabular-nums" :class="pred.scorerBonusPoints > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'">
                  <div class="flex items-center justify-end gap-1">
                    <span v-if="pred.doubledByFavorite && pred.scorerBonusPoints > 0" data-testid="scorer-double-badge" class="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">×2</span>
                    <span>{{ pred.scorerBonusPoints }}</span>
                  </div>
                </td>
                <td data-testid="my-pred-total-points" class="px-4 py-3 text-right">
                  <span class="font-bold" :class="pred.points > 0 ? 'text-blue-700' : 'text-gray-400'">{{ pred.points }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Speciális tippek tab (member) -->
    <div v-if="SHOW_SPECIAL_TIPS && activeTab === 'special'" data-testid="special-tab">
      <div v-if="groupsStore.specialPredictionsLoading" class="text-gray-500">{{ $t('common.loading') }}</div>
      <div v-else-if="groupsStore.specialPredictionsError" class="text-red-600">{{ groupsStore.specialPredictionsError }}</div>
      <div v-else-if="specialPredictions.length === 0" class="text-gray-500 text-sm">{{ $t('groupDetail.specialTabEmpty') }}</div>
      <div v-else class="space-y-3 max-w-lg">
        <div
          v-for="sp in specialPredictions"
          :key="sp.typeId"
          class="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <p class="font-medium text-gray-800 text-sm">{{ sp.typeName }}</p>
              <p v-if="sp.typeDescription" class="text-xs text-gray-500 mt-0.5">{{ sp.typeDescription }}</p>
            </div>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" :class="predictionStatusClass(sp)">
              {{ predictionStatusLabel(sp) }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2 text-xs mb-3">
            <span class="text-gray-500">{{ $t('groupDetail.specialMaxPoints', { n: sp.maxPoints }) }}</span>
            <template v-if="formatRelativeDeadline(sp.deadline, now, t)">
              <span class="text-gray-500">·</span>
              <span :class="formatRelativeDeadline(sp.deadline, now, t)!.cssClass">
                {{ formatRelativeDeadline(sp.deadline, now, t)!.label }}
              </span>
            </template>
          </div>

          <!-- Already evaluated -->
          <div v-if="sp.points !== null" class="text-sm">
            <p class="text-gray-600">{{ $t('groupDetail.specialYourTip', { answer: sp.answerLabel ?? sp.answer ?? '–' }) }}</p>
            <p v-if="sp.correctAnswer" class="text-gray-600">{{ $t('groupDetail.specialCorrectAnswer', { answer: sp.correctAnswerLabel ?? sp.correctAnswer }) }}</p>
            <p class="mt-1 font-semibold" :class="sp.points > 0 ? 'text-green-600' : 'text-gray-400'">
              {{ sp.points > 0 ? $t('groupDetail.specialPointsResult', { n: sp.points }) : $t('groupDetail.specialZeroPoints') }}
            </p>
          </div>

          <!-- Before deadline: submit/edit -->
          <div v-else-if="!isDeadlinePassed(sp.deadline)">
            <div v-if="sp.inputType === 'team_select'" class="mb-2">
              <TeamSelectDropdown
                :model-value="sp.answer ?? null"
                :league-id="currentGroup?.league?.id ?? null"
                :answer-label="sp.answerLabel ?? null"
                @update:model-value="v => onSpecialAnswerChange(sp, v)"
              />
            </div>
            <div v-else-if="sp.inputType === 'player_select'" class="mb-2">
              <PlayerSelectCombobox
                :model-value="sp.answer ?? null"
                :league-id="currentGroup?.league?.id ?? null"
                :answer-label="sp.answerLabel ?? null"
                @update:model-value="v => onSpecialAnswerChange(sp, v)"
              />
            </div>
            <div v-else-if="sp.inputType === 'dropdown' && Array.isArray(sp.options) && sp.options.length">
              <select
                :value="sp.answer ?? ''"
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
                @change="onSpecialAnswerChange(sp, ($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>{{ $t('groupDetail.specialPlaceholder') }}</option>
                <option v-for="opt in sp.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div v-else>
              <input
                :value="textDraft[sp.typeId] ?? sp.answer ?? ''"
                type="text"
                maxlength="500"
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
                :placeholder="$t('groupDetail.specialInputPlaceholder')"
                @input="textDraft[sp.typeId] = ($event.target as HTMLInputElement).value"
                @blur="onSpecialAnswerChange(sp, textDraft[sp.typeId] ?? '')"
              />
            </div>
            <div class="flex items-center gap-2 min-h-[1.25rem]">
              <span v-if="predictionSaveStatus[sp.typeId] === 'saving'" class="text-xs text-gray-500">{{ $t('groupDetail.specialSaving') }}</span>
              <span v-else-if="predictionSaveStatus[sp.typeId] === 'saved'" class="text-xs text-green-600">{{ $t('groupDetail.specialSaved') }}</span>
              <span v-else-if="predictionSaveStatus[sp.typeId] === 'error'" class="text-xs text-red-600">{{ $t('groupDetail.specialError') }}</span>
            </div>
          </div>

          <!-- After deadline, not yet evaluated -->
          <div v-else class="text-sm">
            <p class="text-gray-600">{{ $t('groupDetail.specialYourTip', { answer: sp.answerLabel ?? sp.answer ?? $t('groupDetail.specialNoTip') }) }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ $t('groupDetail.specialExpired') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Set correct answer dialog -->
    <div v-if="setAnswerTypeId !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-1 font-semibold">{{ $t('groupDetail.typeEvaluateDialog') }}</p>
        <p class="text-gray-500 text-sm mb-3">{{ setAnswerTypeName }}</p>
        <div v-if="setAnswerInputType === 'team_select'" class="mb-3">
          <TeamSelectDropdown
            :model-value="setAnswerValue || null"
            :league-id="currentGroup?.league?.id ?? null"
            @update:model-value="v => { setAnswerValue = v ?? '' }"
          />
        </div>
        <div v-else-if="setAnswerInputType === 'player_select'" class="mb-3">
          <PlayerSelectCombobox
            :model-value="setAnswerValue || null"
            :league-id="currentGroup?.league?.id ?? null"
            @update:model-value="v => { setAnswerValue = v ?? '' }"
          />
        </div>
        <input
          v-else
          v-model="setAnswerValue"
          type="text"
          class="w-full border rounded px-3 py-2 text-sm mb-3"
          :placeholder="$t('groupDetail.setAnswerPlaceholder')"
        />
        <div v-if="setAnswerError" class="text-xs text-red-600 mb-2">{{ setAnswerError }}</div>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700" @click="setAnswerTypeId = null">
            {{ $t('common.cancel') }}
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium disabled:opacity-50"
            :disabled="!setAnswerValue.trim() || setAnswerSaving"
            @click="submitSetAnswer"
          >
            {{ $t('groupDetail.typeEvaluateSubmit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Deactivate type confirm dialog -->
    <div v-if="confirmDeactivateTypeId !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">{{ $t('groupDetail.typeDeleteDialog') }}</p>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700" @click="confirmDeactivateTypeId = null">
            {{ $t('common.cancel') }}
          </button>
          <button class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium" @click="onConfirmDeactivate">
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm dialog -->    <div v-if="confirmRemoveUserId !== null" data-testid="confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">{{ $t('groupDetail.removeMemberDialog') }}</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="confirmRemoveUserId = null"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            data-testid="confirm-ok"
            class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium"
            @click="onConfirmRemove"
          >
            {{ $t('groupDetail.removeMemberConfirm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invite confirm dialog -->
    <div v-if="showInviteConfirm" data-testid="invite-confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">{{ $t('groupDetail.inviteRegenerateDialog') }}</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="invite-confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="showInviteConfirm = false"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            data-testid="invite-confirm-ok"
            class="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium"
            @click="onConfirmRegenerate"
          >
            {{ $t('groupDetail.inviteRegenerate') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete group confirm dialog -->
    <div v-if="showDeleteConfirm" data-testid="delete-confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-1 font-semibold">{{ $t('groupDetail.deleteGroupTitle') }}</p>
        <p class="text-gray-500 text-sm mb-4">{{ $t('groupDetail.deleteGroupDesc') }}</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="delete-confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="showDeleteConfirm = false"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            data-testid="delete-confirm-ok"
            class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium"
            @click="onConfirmDelete"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import ScoringExplainerTrigger from '../components/ScoringExplainerTrigger.vue'
import { formatRelativeDeadline } from '../lib/deadline.js'
import TeamSelectDropdown from '../components/predictions/TeamSelectDropdown.vue'
import PlayerSelectCombobox from '../components/predictions/PlayerSelectCombobox.vue'
import ScoringOverrideModal from '../components/admin/ScoringOverrideModal.vue'
import SupporterBadge from '../components/SupporterBadge.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { useLeagueFavoritesStore } from '../stores/league-favorites.store.js'
import { useMatchesStore } from '../stores/matches.store.js'
import { hasAnyLiveMatch } from '../composables/useLiveMatchPolling.js'
import { useMatchEvents, type MatchUpdateEvent } from '../composables/useMatchEvents.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { GroupMember, GroupMatchPrediction, LeaderboardEntry, ScoringConfigInput, SpecialPredictionOptions, SpecialTypeInput, StatPredictionTemplate, GlobalTypeWithSubscription, VirtualPointEntry } from '../types/index.js'
import { getDateLocale } from '../lib/dateLocale.js'

type Tab = 'leaderboard' | 'my-predictions' | 'members' | 'settings' | 'special'

const SHOW_SPECIAL_TIPS = false

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric' })
}

function isExactMatch(pred: GroupMatchPrediction): boolean {
  return pred.homeGoals === pred.resultHomeGoals && pred.awayGoals === pred.resultAwayGoals
}

function myPredRowClass(pred: GroupMatchPrediction): string {
  if (isExactMatch(pred)) return 'bg-green-50'
  if (pred.matchPoints > 0) return 'bg-yellow-50'
  return ''
}

function myPredTipClass(pred: GroupMatchPrediction): string {
  if (isExactMatch(pred)) return 'text-green-700 font-bold'
  if (pred.matchPoints > 0) return 'text-yellow-700 font-semibold'
  return 'text-gray-500'
}

function myPredScorerNameClass(pred: GroupMatchPrediction): string {
  if (pred.scorerPickPlayerName === null) return 'text-gray-400'
  if (pred.scorerBonusPoints > 0) return 'text-green-700 font-bold'
  return 'text-gray-500 line-through decoration-gray-300'
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()
const leagueStore = useLeagueFavoritesStore()
const matchesStore = useMatchesStore()

const groupId = route.params.id as string

const now = ref(Date.now())
let deadlineTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { deadlineTimer = setInterval(() => { now.value = Date.now() }, 60_000) })
onUnmounted(() => { if (deadlineTimer) clearInterval(deadlineTimer) })
const entries = ref<LeaderboardEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<Tab>('leaderboard')

const confirmRemoveUserId = ref<string | null>(null)

// ─── Lightweight name resolution for admin display ─────────────────────────
const teamNameCache = ref<Map<string, string>>(new Map())
const playerNameCache = ref<Map<string, string>>(new Map())

function resolveAnswerLabel(inputType: string, value: string | null): string {
  if (!value) return '–'
  if (inputType === 'team_select') return teamNameCache.value.get(value) ?? value
  if (inputType === 'player_select') return playerNameCache.value.get(value) ?? value
  return value
}

async function loadNameCachesIfNeeded(): Promise<void> {
  if (teamNameCache.value.size === 0) {
    try {
      const token = await getAccessToken()
      const teams = await api.teams.list(token)
      for (const t of teams) teamNameCache.value.set(t.id, t.name)
    } catch { /* ignore */ }
  }
  if (playerNameCache.value.size === 0) {
    try {
      const token = await getAccessToken()
      const players = await api.players.list(token)
      for (const p of players) playerNameCache.value.set(p.id, p.name)
    } catch { /* ignore */ }
  }
}

const groupName = computed(() => groupsStore.groups.find(g => g.id === groupId)?.name ?? t('nav.groups'))
const currentGroup = computed(() => groupsStore.groups.find(g => g.id === groupId))
const members = computed(() => groupsStore.membersMap[groupId] ?? [])
const currentUserIsGroupAdmin = computed(() =>
  groupsStore.membersMap[groupId]?.some(m => m.userId === authStore.user?.id && m.isAdmin) ?? false,
)
const isGlobalAdmin = computed(() => authStore.user?.role === 'admin')
const canManageSettings = computed(() => currentUserIsGroupAdmin.value || isGlobalAdmin.value)

const showInviteConfirm = ref(false)
const showDeleteConfirm = ref(false)
const copiedInvite = ref<'code' | 'url' | null>(null)

// ─── Special prediction types (admin) ────────────────────────────────────────
const showTypeForm = ref(false)
const editingTypeId = ref<string | null>(null)
const typeFormSaving = ref(false)
const typeFormError = ref<string | null>(null)
const confirmDeactivateTypeId = ref<string | null>(null)

// ─── Templates ──────────────────────────────────────────────────────────────
const templates = ref<StatPredictionTemplate[]>([])
const templatesLoaded = ref(false)

async function loadTemplatesIfNeeded(): Promise<void> {
  if (templatesLoaded.value) return
  try {
    const token = await getAccessToken()
    templates.value = await api.statPredictionTemplates.list(token)
    templatesLoaded.value = true
  } catch { /* ignore */ }
}

function applyTemplate(tpl: StatPredictionTemplate): void {
  typeDraft.name = tpl.name
  typeDraft.description = tpl.description
  typeDraft.inputType = tpl.inputType as typeof typeDraft.inputType
  typeDraft.optionsRaw = tpl.options?.join(', ') ?? ''
  typeDraft.points = tpl.defaultPoints
  editingTypeId.value = null
  typeFormError.value = null
  showTypeForm.value = true
}

const typeDraft = reactive({
  name: '',
  description: '',
  inputType: 'text' as 'text' | 'dropdown' | 'team_select' | 'player_select',
  optionsRaw: '',
  points: 5,
  deadline: '',
})

const specialTypes = computed(() => (groupsStore.specialTypesMap[groupId] ?? []).filter(t => !t.isGlobal))

// ─── Set correct answer dialog ───────────────────────────────────────────────
const setAnswerTypeId = ref<string | null>(null)
const setAnswerTypeName = ref('')
const setAnswerInputType = ref<string>('text')
const setAnswerValue = ref('')
const setAnswerSaving = ref(false)
const setAnswerError = ref<string | null>(null)

// ─── Special predictions (member) ────────────────────────────────────────────
const specialPredictions = computed(() => groupsStore.specialPredictionsMap[groupId] ?? [])
const textDraft = reactive<Record<string, string>>({})
const predictionSaveStatus = reactive<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})

// ─── Global type subscriptions (admin) ──────────────────────────────────────
const globalSubscriptions = computed(() => groupsStore.globalSubscriptionsMap[groupId] ?? [])
const subscriptionToggling = reactive<Record<string, boolean>>({})

async function toggleGlobalSubscription(gt: GlobalTypeWithSubscription): Promise<void> {
  subscriptionToggling[gt.id] = true
  try {
    if (gt.subscribed) {
      await groupsStore.unsubscribeGlobalType(groupId, gt.id)
    } else {
      await groupsStore.subscribeGlobalType(groupId, gt.id)
    }
  } catch { /* error handled by store */ }
  subscriptionToggling[gt.id] = false
}

const scoringFields: Array<{ key: keyof ScoringConfigInput; label: string }> = [
  { key: 'correctOutcomePoints', label: t('scoring.correctOutcome') },
  { key: 'exactBonusPoints', label: t('scoring.exactBonus') },
  { key: 'extraTimeBonusPoints', label: t('scoring.extraTimeBonus') },
]

type ScoringDraft = {
  correctOutcomePoints: number
  exactBonusPoints: number
  extraTimeBonusPoints: number
}

const scoringDraft = reactive<ScoringDraft>({
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
})

watch(
  () => groupsStore.groupScoringConfigs[groupId],
  (cfg) => {
    if (!cfg) return
    scoringDraft.correctOutcomePoints = cfg.correctOutcomePoints
    scoringDraft.exactBonusPoints = cfg.exactBonusPoints
    scoringDraft.extraTimeBonusPoints = cfg.extraTimeBonusPoints
  },
  { immediate: true },
)

async function submitScoringConfig(): Promise<void> {
  await groupsStore.setGroupScoringConfig(groupId, { ...scoringDraft })
}

const overrideScoringOpen = ref(false)
const isGroupScoringFrozen = computed(() => Boolean(groupsStore.groupScoringConfigs[groupId]?.frozenAt))

async function onScoringOverrideConfirm(payload: { reason: string; comment: string; recalculate: boolean }): Promise<void> {
  overrideScoringOpen.value = false
  await groupsStore.overrideGroupScoringConfig(groupId, {
    values: { ...scoringDraft },
    reason: payload.reason,
    comment: payload.comment || undefined,
    recalculate: payload.recalculate,
  })
}

function setCopiedInvite(type: 'code' | 'url'): void {
  copiedInvite.value = type
  setTimeout(() => { copiedInvite.value = null }, 2000)
}

async function onToggleAdmin(member: GroupMember): Promise<void> {
  await groupsStore.toggleMemberAdmin(groupId, member.userId, !member.isAdmin)
}

async function onTogglePaid(member: GroupMember): Promise<void> {
  await groupsStore.setMemberPaid(groupId, member.userId, !member.isPaid)
}

async function onConfirmRemove(): Promise<void> {
  if (!confirmRemoveUserId.value) return
  const userId = confirmRemoveUserId.value
  confirmRemoveUserId.value = null
  await groupsStore.removeMember(groupId, userId)
}

async function onToggleInvite(): Promise<void> {
  const active = currentGroup.value?.inviteActive
  if (active === undefined) return
  await groupsStore.setInviteActive(groupId, !active)
}

async function toggleFavDoublePoints(): Promise<void> {
  const current = currentGroup.value?.favoriteTeamDoublePoints ?? false
  await groupsStore.updateGroupSettings(groupId, { favoriteTeamDoublePoints: !current })
}

// ─── League editing ──────────────────────────────────────────────────────────
const leagueDraft = ref('')
const leagueSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

async function submitLeagues(): Promise<void> {
  if (!leagueDraft.value) return
  leagueSaveStatus.value = 'saving'
  try {
    await groupsStore.setGroupLeague(groupId, leagueDraft.value)
    leagueSaveStatus.value = 'saved'
    setTimeout(() => { leagueSaveStatus.value = 'idle' }, 3000)
  } catch {
    leagueSaveStatus.value = 'error'
  }
}

async function onConfirmRegenerate(): Promise<void> {
  showInviteConfirm.value = false
  await groupsStore.regenerateInvite(groupId)
}

async function onConfirmDelete(): Promise<void> {
  showDeleteConfirm.value = false
  await groupsStore.deleteGroup(groupId)
  await router.push('/app/groups')
}

function copyInviteCode(): void {
  const code = currentGroup.value?.inviteCode
  if (code) {
    navigator.clipboard.writeText(code)
    setCopiedInvite('code')
  }
}

function copyInviteUrl(): void {
  const code = currentGroup.value?.inviteCode
  if (code) {
    navigator.clipboard.writeText(`${window.location.origin}/app/join/${code}`)
    setCopiedInvite('url')
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isDeadlinePassed(deadline: string): boolean {
  return new Date(deadline).getTime() < Date.now()
}

// ─── Special type form ───────────────────────────────────────────────────────

function openNewTypeForm(): void {
  editingTypeId.value = null
  typeDraft.name = ''
  typeDraft.description = ''
  typeDraft.inputType = 'text'
  typeDraft.optionsRaw = ''
  typeDraft.points = 5
  typeDraft.deadline = ''
  typeFormError.value = null
  showTypeForm.value = true
}

function openEditType(st: { id: string; name: string; description: string | null; inputType: string; options: SpecialPredictionOptions; points: number; deadline: string }): void {
  editingTypeId.value = st.id
  typeDraft.name = st.name
  typeDraft.description = st.description ?? ''
  typeDraft.inputType = st.inputType as typeof typeDraft.inputType
  typeDraft.optionsRaw = Array.isArray(st.options) ? st.options.join(', ') : ''
  typeDraft.points = st.points
  typeDraft.deadline = st.deadline.slice(0, 16)
  typeFormError.value = null
  showTypeForm.value = true
}

async function submitTypeForm(): Promise<void> {
  typeFormError.value = null
  typeFormSaving.value = true
  try {
    const options = typeDraft.inputType === 'dropdown'
      ? typeDraft.optionsRaw.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    const input: SpecialTypeInput = {
      name: typeDraft.name,
      description: typeDraft.description || undefined,
      inputType: typeDraft.inputType,
      options,
      deadline: new Date(typeDraft.deadline).toISOString(),
      points: typeDraft.points,
    }
    if (editingTypeId.value) {
      await groupsStore.updateSpecialType(groupId, editingTypeId.value, input)
    } else {
      await groupsStore.createSpecialType(groupId, input)
    }
    showTypeForm.value = false
  } catch (err) {
    typeFormError.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    typeFormSaving.value = false
  }
}

async function onConfirmDeactivate(): Promise<void> {
  if (!confirmDeactivateTypeId.value) return
  const id = confirmDeactivateTypeId.value
  confirmDeactivateTypeId.value = null
  const type = specialTypes.value.find(t => t.id === id)
  if (type?.isGlobal) {
    await groupsStore.unsubscribeGlobalType(groupId, id)
    groupsStore.specialTypesMap[groupId] = (groupsStore.specialTypesMap[groupId] ?? []).filter(t => t.id !== id)
  } else {
    await groupsStore.deactivateSpecialType(groupId, id)
  }
}

function openSetAnswer(st: { id: string; name: string; inputType: string }): void {
  setAnswerTypeId.value = st.id
  setAnswerTypeName.value = st.name
  setAnswerInputType.value = st.inputType
  setAnswerValue.value = ''
  setAnswerError.value = null
}

async function submitSetAnswer(): Promise<void> {
  if (!setAnswerTypeId.value || !setAnswerValue.value.trim()) return
  setAnswerSaving.value = true
  setAnswerError.value = null
  try {
    await groupsStore.setSpecialTypeAnswer(groupId, setAnswerTypeId.value, setAnswerValue.value.trim())
    setAnswerTypeId.value = null
  } catch (err) {
    setAnswerError.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    setAnswerSaving.value = false
  }
}

// ─── Special predictions (member) ────────────────────────────────────────────

function predictionStatusClass(sp: { points: number | null; answer: string | null; deadline: string }): string {
  if (sp.points !== null) return sp.points > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  if (isDeadlinePassed(sp.deadline)) return 'bg-yellow-100 text-yellow-700'
  if (sp.answer) return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-500'
}

function predictionStatusLabel(sp: { points: number | null; answer: string | null; deadline: string }): string {
  if (sp.points !== null) return sp.points > 0 ? `+${sp.points}` : t('groupDetail.predStatusZero')
  if (isDeadlinePassed(sp.deadline)) return t('groupDetail.predStatusPending')
  if (sp.answer) return t('groupDetail.predStatusSubmitted')
  return t('groupDetail.predStatusOpen')
}

async function onSpecialAnswerChange(
  sp: { typeId: string; answer: string | null },
  value: string | null,
): Promise<void> {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return
  if (trimmed === (sp.answer ?? '')) return
  predictionSaveStatus[sp.typeId] = 'saving'
  try {
    await groupsStore.upsertSpecialPrediction(groupId, { typeId: sp.typeId, answer: trimmed })
    predictionSaveStatus[sp.typeId] = 'saved'
    delete textDraft[sp.typeId]
    setTimeout(() => { predictionSaveStatus[sp.typeId] = 'idle' }, 2000)
  } catch {
    predictionSaveStatus[sp.typeId] = 'error'
  }
}

async function switchToSpecialTab(): Promise<void> {
  activeTab.value = 'special'
  if (!groupsStore.specialPredictionsMap[groupId]) {
    await groupsStore.fetchSpecialPredictions(groupId)
  }
}

async function switchToMyPredictionsTab(): Promise<void> {
  activeTab.value = 'my-predictions'
  if (!groupsStore.myGroupPredictionsMap[groupId]) {
    await groupsStore.fetchMyGroupPredictions(groupId)
  }
  await fetchVirtualPoints()
  evaluatePollingState()
}

const myGroupPredictions = computed(() => groupsStore.myGroupPredictionsMap[groupId] ?? null)

const virtualPoints = ref<VirtualPointEntry[]>([])
let virtualPointsTimer: ReturnType<typeof setInterval> | null = null

const VIRTUAL_POINTS_POLL_INTERVAL_MS = 60_000

const hasLiveMatch = computed(() => hasAnyLiveMatch(matchesStore.matches))

const matchEvents = useMatchEvents({
  onMatchUpdate: (event: MatchUpdateEvent) => {
    matchesStore.applyMatchUpdate(event)
    if (activeTab.value === 'my-predictions') {
      void fetchVirtualPoints()
    }
  },
})

async function fetchVirtualPoints(): Promise<void> {
  try {
    const token = await getAccessToken()
    virtualPoints.value = await api.matches.virtualPoints(token, groupId)
  } catch {
    virtualPoints.value = []
  }
}

function startVirtualPointsPolling(): void {
  // SSE takes over when connected — no polling fallback needed.
  if (matchEvents.isConnected.value) {
    stopVirtualPointsPolling()
    return
  }
  stopVirtualPointsPolling()
  virtualPointsTimer = setInterval(() => {
    if (activeTab.value !== 'my-predictions' || !hasLiveMatch.value || document.hidden) {
      stopVirtualPointsPolling()
      return
    }
    void fetchVirtualPoints()
  }, VIRTUAL_POINTS_POLL_INTERVAL_MS)
}

function stopVirtualPointsPolling(): void {
  if (virtualPointsTimer) {
    clearInterval(virtualPointsTimer)
    virtualPointsTimer = null
  }
}

function evaluatePollingState(): void {
  // When SSE is healthy, push delivers updates — no polling needed.
  if (matchEvents.isConnected.value) {
    stopVirtualPointsPolling()
    return
  }
  const shouldPoll =
    activeTab.value === 'my-predictions' && hasLiveMatch.value && !document.hidden
  if (shouldPoll) startVirtualPointsPolling()
  else stopVirtualPointsPolling()
}

function onVisibilityChange(): void {
  if (document.hidden) {
    stopVirtualPointsPolling()
  } else if (activeTab.value === 'my-predictions') {
    void fetchVirtualPoints()
    if (hasLiveMatch.value) startVirtualPointsPolling()
  }
}

watch([activeTab, hasLiveMatch, matchEvents.isConnected], () => {
  evaluatePollingState()
})

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopVirtualPointsPolling()
})

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    if (groupsStore.groups.length === 0) await groupsStore.fetchMyGroups()
    const token = await getAccessToken()
    entries.value = await api.groups.leaderboard(token, groupId)
    await groupsStore.fetchGroupMembers(groupId)
    if (canManageSettings.value) {
      await groupsStore.fetchGroupScoringConfig(groupId)
      await groupsStore.fetchSpecialTypes(groupId)
      await groupsStore.fetchGlobalSubscriptions(groupId)
      await leagueStore.fetchLeagues()
      leagueDraft.value = currentGroup.value?.league?.id ?? ''
      await loadTemplatesIfNeeded()
      await loadNameCachesIfNeeded()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.unknownError')
  } finally {
    isLoading.value = false
  }

  if (route.query.tab === 'special' && SHOW_SPECIAL_TIPS) {
    await switchToSpecialTab()
  }
  if (route.query.tab === 'my-predictions') {
    await switchToMyPredictionsTab()
  }
})
</script>
