<template>
  <AppLayout>
    <div class="flex items-center gap-3 mb-6">
      <router-link to="/app/groups" class="text-blue-600 hover:text-blue-800 text-sm">← Csoportok</router-link>
      <h1 class="text-2xl font-bold text-gray-900">{{ groupName }}</h1>
    </div>

    <div data-testid="tab-bar" class="flex border-b border-gray-200 mb-6">
      <button
        data-testid="tab-leaderboard"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'leaderboard' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="activeTab = 'leaderboard'"
      >
        Ranglista
      </button>
      <button
        data-testid="tab-special"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'special' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="switchToSpecialTab"
      >
        Stat tippek
      </button>
      <button
        v-if="currentUserIsGroupAdmin"
        data-testid="tab-members"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'members' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="activeTab = 'members'"
      >
        Tagok
      </button>
      <button
        v-if="canManageSettings"
        data-testid="tab-settings"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="activeTab = 'settings'"
      >
        Beállítások
      </button>
    </div>

    <!-- Ranglista tab -->
    <div v-if="activeTab === 'leaderboard'">
      <div v-if="isLoading" class="text-gray-500">Betöltés...</div>
      <div v-else-if="error" class="text-red-600">{{ error }}</div>
      <div v-else-if="entries.length === 0" class="text-gray-500">Még nincs ranglista adat.</div>
      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm table-fixed">
          <colgroup>
            <col class="w-12" />
            <col />
            <col class="w-16" />
            <col class="w-16" />
            <col class="w-14" />
            <col class="w-16" />
          </colgroup>
          <thead>
            <tr class="border-b border-gray-200 text-gray-500 text-left">
              <th class="px-4 py-3">#</th>
              <th class="px-4 py-3">Játékos</th>
              <th class="px-4 py-3 text-right">Tipp</th>
              <th class="px-4 py-3 text-right">Helyes</th>
              <th class="px-4 py-3 text-right" title="Stat tipp pontok">Stat</th>
              <th class="px-4 py-3 text-right font-semibold">Pont</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.userId"
              class="border-b border-gray-100 last:border-0 transition-colors"
              :class="entry.userId === authStore.user?.id ? 'bg-blue-50' : 'hover:bg-gray-50'"
            >
              <td class="px-4 py-3 text-gray-400 font-medium">{{ entry.rank }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2 min-w-0">
                  <img
                    :src="entry.avatarUrl ?? dicebearUrl(entry.displayName)"
                    :alt="entry.displayName"
                    class="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <span class="font-medium text-gray-800 truncate">{{ entry.displayName }}</span>
                  <span v-if="entry.userId === authStore.user?.id" class="text-xs text-blue-600 shrink-0">(te)</span>
                </div>
              </td>
              <td class="px-4 py-3 text-right text-gray-600">{{ entry.predictionCount }}</td>
              <td class="px-4 py-3 text-right text-gray-600">{{ entry.correctCount }}</td>
              <td class="px-4 py-3 text-right text-gray-500">{{ entry.specialPredictionPoints ?? 0 }}</td>
              <td class="px-4 py-3 text-right font-bold text-blue-700">{{ entry.totalPoints }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tagok tab -->
    <div v-else-if="activeTab === 'members'" data-testid="members-tab">
      <div v-if="groupsStore.membersLoading" data-testid="members-spinner" class="text-gray-500">Betöltés...</div>
      <div v-else-if="groupsStore.membersError" class="text-red-600">{{ groupsStore.membersError }}</div>
      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-gray-500 text-left">
              <th class="px-4 py-3">Tag</th>
              <th class="px-4 py-3">Szerep</th>
              <th class="px-4 py-3">Csatlakozott</th>
              <th v-if="currentUserIsGroupAdmin" class="px-4 py-3">Műveletek</th>
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
                  <span v-if="member.userId === authStore.user?.id" class="text-xs text-blue-600">(te)</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="member.isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ member.isAdmin ? 'Admin' : 'Tag' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(member.joinedAt) }}</td>
              <td v-if="currentUserIsGroupAdmin" class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    :disabled="member.userId === authStore.user?.id"
                    class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="onToggleAdmin(member)"
                  >
                    {{ member.isAdmin ? 'Admin visszavon' : 'Admin' }}
                  </button>
                  <button
                    :disabled="member.userId === authStore.user?.id"
                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="confirmRemoveUserId = member.userId"
                  >
                    Eltávolít
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invite section (admin only, inside members tab) -->
    <div v-if="activeTab === 'members' && currentUserIsGroupAdmin" data-testid="invite-section" class="mt-6 bg-white rounded-xl border border-gray-200 p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Meghívó kód</h3>
      <div class="flex items-center gap-2 mb-3">
        <span data-testid="invite-code-display" class="font-mono text-lg font-bold tracking-widest text-gray-900">{{ currentGroup?.inviteCode }}</span>
        <button
          class="text-xs px-2 py-1 rounded border transition-all duration-200"
          :class="copiedInvite === 'code' ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'"
          @click="copyInviteCode"
        >
          {{ copiedInvite === 'code' ? '✓ Másolva' : 'Kód' }}
        </button>
        <button
          class="text-xs px-2 py-1 rounded border transition-all duration-200"
          :class="copiedInvite === 'url' ? 'border-green-400 bg-green-50 text-green-600' : 'border-blue-300 text-blue-600 hover:border-blue-400'"
          @click="copyInviteUrl"
        >
          {{ copiedInvite === 'url' ? '✓ Másolva' : 'Link másolása' }}
        </button>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">
          Állapot: <span :class="currentGroup?.inviteActive ? 'text-green-600' : 'text-red-500'">{{ currentGroup?.inviteActive ? 'Aktív' : 'Inaktív' }}</span>
        </span>
        <button
          data-testid="invite-toggle-btn"
          class="text-xs px-2 py-1 rounded border"
          :class="currentGroup?.inviteActive ? 'border-red-300 text-red-600' : 'border-green-300 text-green-600'"
          @click="onToggleInvite"
        >
          {{ currentGroup?.inviteActive ? 'Deaktiválás' : 'Aktiválás' }}
        </button>
        <button
          data-testid="invite-regenerate-btn"
          class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600"
          @click="showInviteConfirm = true"
        >
          Újragenerálás
        </button>
      </div>
    </div>

    <!-- Csoport törlése (admin only) -->
    <div v-if="activeTab === 'members' && currentUserIsGroupAdmin" class="mt-4">
      <button
        data-testid="delete-group-btn"
        class="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        @click="showDeleteConfirm = true"
      >
        Csoport törlése
      </button>
    </div>

    <!-- Beállítások tab -->
    <div v-if="activeTab === 'settings'" data-testid="settings-tab">
      <div v-if="groupsStore.groupScoringLoading" class="text-gray-500">Betöltés...</div>
      <div v-else-if="groupsStore.groupScoringError" class="text-red-600">{{ groupsStore.groupScoringError }}</div>
      <div v-else class="max-w-md">
        <h3 class="text-base font-semibold text-gray-800 mb-1">Egyedi pontrendszer</h3>
        <p class="text-sm text-gray-500 mb-4">Ha beállítod, a csoport ranglista ezt a pontrendszert használja a globális helyett.</p>
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
              class="w-20 border rounded px-2 py-1 text-center"
            />
          </div>
          <div class="flex items-center gap-4 pt-2">
            <button
              type="submit"
              data-testid="settings-submit"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              :disabled="groupsStore.groupScoringSaveStatus === 'saving'"
            >
              Mentés
            </button>
            <span
              v-if="groupsStore.groupScoringSaveStatus === 'saved'"
              data-testid="settings-save-status"
              class="text-sm text-green-600"
            >
              Elmentve!
            </span>
            <span
              v-else-if="groupsStore.groupScoringSaveStatus === 'error'"
              data-testid="settings-save-status"
              class="text-sm text-red-600"
            >
              Hiba a mentés során
            </span>
          </div>
        </form>
      </div>

      <!-- Globális stat tippek kezelése (admin) -->
      <div class="mt-8 max-w-lg">
        <h3 class="text-base font-semibold text-gray-800 mb-1">Globális stat tippek</h3>
        <p class="text-sm text-gray-500 mb-4">Kapcsold be, amelyekre a tagok tippelhetnek.</p>

        <div v-if="groupsStore.globalSubscriptionsLoading" class="text-gray-500 text-sm">Betöltés...</div>
        <div v-else-if="groupsStore.globalSubscriptionsError" class="text-red-600 text-sm">{{ groupsStore.globalSubscriptionsError }}</div>
        <div v-else-if="globalSubscriptions.length === 0" class="text-sm text-gray-400">Nincs elérhető globális stat tipp típus.</div>
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
                <span>{{ gt.points }} pont</span>
                <span>·</span>
                <span>Határidő: {{ formatDateTime(gt.deadline) }}</span>
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
                {{ gt.subscribed ? 'Aktív' : 'Inaktív' }}
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Stat tipp típusok kezelése (admin) -->
      <div class="mt-8 max-w-lg">
        <h3 class="text-base font-semibold text-gray-800 mb-1">Stat tipp típusok</h3>
        <p class="text-sm text-gray-500 mb-4">Hozz létre egyedi stat tippeket a csoport számára (pl. Gólkirály, Legjobb csapat).</p>

        <div v-if="groupsStore.specialTypesLoading" class="text-gray-500 text-sm">Betöltés...</div>
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
                    <span>{{ st.inputType === 'dropdown' ? 'Legördülő' : st.inputType === 'team_select' ? 'Csapatválasztó' : 'Szabad szöveg' }}</span>
                    <span>·</span>
                    <span>{{ st.points }} pont</span>
                    <span>·</span>
                    <span>Határidő: {{ formatDateTime(st.deadline) }}</span>
                  </div>
                  <div v-if="st.options?.length" class="mt-1 text-xs text-gray-400">
                    Opciók: {{ st.options.join(', ') }}
                  </div>
                  <div v-if="st.correctAnswer" class="mt-1 text-xs text-green-600 font-medium">
                    Helyes válasz: {{ st.inputType === 'team_select' ? teamName(st.correctAnswer) : st.correctAnswer }}
                  </div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button
                    v-if="!st.correctAnswer"
                    class="text-xs px-2 py-1 rounded border border-green-300 text-green-600 hover:bg-green-50"
                    @click="openSetAnswer(st)"
                  >
                    Kiértékel
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
                    @click="openEditType(st)"
                  >
                    Szerkeszt
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                    @click="confirmDeactivateTypeId = st.id"
                  >
                    Törlés
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-400 mb-4">Még nincs stat tipp típus.</div>

          <!-- Template picker -->
          <div v-if="templates.length > 0 && !showTypeForm" class="mb-4">
            <p class="text-xs font-medium text-gray-600 mb-2">Sablon választása:</p>
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
            + Új stat tipp típus
          </button>

          <form v-if="showTypeForm" class="border rounded-lg p-4 bg-gray-50 space-y-3" @submit.prevent="submitTypeForm">
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">Név *</label>
              <input v-model="typeDraft.name" type="text" maxlength="100" required class="w-full border rounded px-2 py-1 text-sm" placeholder="pl. Gólkirály" />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">Leírás</label>
              <input v-model="typeDraft.description" type="text" class="w-full border rounded px-2 py-1 text-sm" placeholder="Opcionális leírás" />
            </div>
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="text-xs font-medium text-gray-600 block mb-1">Típus</label>
                <select v-model="typeDraft.inputType" class="w-full border rounded px-2 py-1 text-sm" @change="onInputTypeChange">
                  <option value="text">Szabad szöveg</option>
                  <option value="dropdown">Legördülő</option>
                  <option value="team_select">Csapatválasztó</option>
                </select>
              </div>
              <div class="w-24">
                <label class="text-xs font-medium text-gray-600 block mb-1">Pont</label>
                <input v-model.number="typeDraft.points" type="number" min="1" max="100" required class="w-full border rounded px-2 py-1 text-sm text-center" />
              </div>
            </div>
            <div v-if="typeDraft.inputType === 'dropdown'">
              <label class="text-xs font-medium text-gray-600 block mb-1">Opciók (vesszővel elválasztva)</label>
              <input v-model="typeDraft.optionsRaw" type="text" class="w-full border rounded px-2 py-1 text-sm" placeholder="Messi, Ronaldo, Mbappé" />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 block mb-1">Határidő *</label>
              <input v-model="typeDraft.deadline" type="datetime-local" required class="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div v-if="typeFormError" class="text-xs text-red-600">{{ typeFormError }}</div>
            <div class="flex gap-2 pt-1">
              <button type="submit" class="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="typeFormSaving">
                {{ editingTypeId ? 'Mentés' : 'Létrehozás' }}
              </button>
              <button type="button" class="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600" @click="showTypeForm = false">
                Mégse
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Stat tippek tab (member) -->
    <div v-if="activeTab === 'special'" data-testid="special-tab">
      <div v-if="groupsStore.specialPredictionsLoading" class="text-gray-500">Betöltés...</div>
      <div v-else-if="groupsStore.specialPredictionsError" class="text-red-600">{{ groupsStore.specialPredictionsError }}</div>
      <div v-else-if="specialPredictions.length === 0" class="text-gray-500 text-sm">Ebben a csoportban még nincsenek stat tippek.</div>
      <div v-else class="space-y-3 max-w-lg">
        <div
          v-for="sp in specialPredictions"
          :key="sp.typeId"
          class="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <div class="flex items-center gap-1.5">
                <p class="font-medium text-gray-800 text-sm">{{ sp.typeName }}</p>
                <span v-if="sp.isGlobal" class="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Platform</span>
              </div>
              <p v-if="sp.typeDescription" class="text-xs text-gray-500 mt-0.5">{{ sp.typeDescription }}</p>
            </div>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" :class="predictionStatusClass(sp)">
              {{ predictionStatusLabel(sp) }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
            <span>Max {{ sp.maxPoints }} pont</span>
            <span>·</span>
            <span>Határidő: {{ formatDateTime(sp.deadline) }}</span>
          </div>

          <!-- Already evaluated -->
          <div v-if="sp.points !== null" class="text-sm">
            <p class="text-gray-600">Tipped: <span class="font-medium text-gray-800">{{ sp.inputType === 'team_select' && sp.answer ? teamName(sp.answer) : (sp.answer ?? '–') }}</span></p>
            <p v-if="sp.correctAnswer" class="text-gray-600">Helyes válasz: <span class="font-medium text-green-700">{{ sp.inputType === 'team_select' ? teamName(sp.correctAnswer) : sp.correctAnswer }}</span></p>
            <p class="mt-1 font-semibold" :class="sp.points > 0 ? 'text-green-600' : 'text-gray-400'">
              {{ sp.points > 0 ? `+${sp.points} pont` : '0 pont' }}
            </p>
          </div>

          <!-- Before deadline: submit/edit -->
          <div v-else-if="!isDeadlinePassed(sp.deadline)">
            <div v-if="sp.inputType === 'team_select'">
              <select
                :value="pendingAnswers[sp.typeId] ?? sp.answer ?? ''"
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
                @change="pendingAnswers[sp.typeId] = ($event.target as HTMLSelectElement).value"
              >
                <option value="" disabled>Válassz csapatot...</option>
                <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div v-else-if="sp.inputType === 'dropdown' && sp.options?.length">
              <select
                :value="pendingAnswers[sp.typeId] ?? sp.answer ?? ''"
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
                @change="pendingAnswers[sp.typeId] = ($event.target as HTMLSelectElement).value"
              >
                <option value="" disabled>Válassz...</option>
                <option v-for="opt in sp.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div v-else>
              <input
                :value="pendingAnswers[sp.typeId] ?? sp.answer ?? ''"
                type="text"
                maxlength="500"
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
                placeholder="Írd be a tipped..."
                @input="pendingAnswers[sp.typeId] = ($event.target as HTMLInputElement).value"
              />
            </div>
            <div class="flex items-center gap-2">
              <button
                class="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                :disabled="!canSubmitPrediction(sp)"
                @click="submitPrediction(sp.typeId)"
              >
                {{ sp.answer ? 'Módosít' : 'Leadás' }}
              </button>
              <span v-if="sp.answer" class="text-xs text-gray-400">Jelenlegi: {{ sp.inputType === 'team_select' ? teamName(sp.answer) : sp.answer }}</span>
              <span v-if="predictionSaveStatus[sp.typeId] === 'saved'" class="text-xs text-green-600">Mentve!</span>
              <span v-else-if="predictionSaveStatus[sp.typeId] === 'error'" class="text-xs text-red-600">Hiba</span>
            </div>
          </div>

          <!-- After deadline, not yet evaluated -->
          <div v-else class="text-sm">
            <p class="text-gray-600">Tipped: <span class="font-medium text-gray-800">{{ sp.inputType === 'team_select' && sp.answer ? teamName(sp.answer) : (sp.answer ?? 'Nem adtál le tippet') }}</span></p>
            <p class="text-xs text-gray-400 mt-1">A határidő lejárt, kiértékelésre vár.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Set correct answer dialog -->
    <div v-if="setAnswerTypeId !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-1 font-semibold">Helyes válasz megadása</p>
        <p class="text-gray-500 text-sm mb-3">{{ setAnswerTypeName }}</p>
        <select
          v-if="setAnswerInputType === 'team_select'"
          v-model="setAnswerValue"
          class="w-full border rounded px-3 py-2 text-sm mb-3"
        >
          <option value="" disabled>Válassz csapatot...</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <input
          v-else
          v-model="setAnswerValue"
          type="text"
          class="w-full border rounded px-3 py-2 text-sm mb-3"
          placeholder="Helyes válasz..."
        />
        <div v-if="setAnswerError" class="text-xs text-red-600 mb-2">{{ setAnswerError }}</div>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700" @click="setAnswerTypeId = null">
            Mégse
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium disabled:opacity-50"
            :disabled="!setAnswerValue.trim() || setAnswerSaving"
            @click="submitSetAnswer"
          >
            Kiértékelés
          </button>
        </div>
      </div>
    </div>

    <!-- Deactivate type confirm dialog -->
    <div v-if="confirmDeactivateTypeId !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">Biztosan törölni szeretnéd ezt a stat tipp típust?</p>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700" @click="confirmDeactivateTypeId = null">
            Mégse
          </button>
          <button class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium" @click="onConfirmDeactivate">
            Törlés
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm dialog -->    <div v-if="confirmRemoveUserId !== null" data-testid="confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">Biztosan el szeretnéd távolítani ezt a tagot?</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="confirmRemoveUserId = null"
          >
            Mégse
          </button>
          <button
            data-testid="confirm-ok"
            class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium"
            @click="onConfirmRemove"
          >
            Eltávolítás
          </button>
        </div>
      </div>
    </div>

    <!-- Invite confirm dialog -->
    <div v-if="showInviteConfirm" data-testid="invite-confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">Biztosan újra szeretnéd generálni a meghívó kódot? A régi kód érvénytelenné válik.</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="invite-confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="showInviteConfirm = false"
          >
            Mégse
          </button>
          <button
            data-testid="invite-confirm-ok"
            class="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium"
            @click="onConfirmRegenerate"
          >
            Újragenerálás
          </button>
        </div>
      </div>
    </div>

    <!-- Delete group confirm dialog -->
    <div v-if="showDeleteConfirm" data-testid="delete-confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-1 font-semibold">Csoport törlése</p>
        <p class="text-gray-500 text-sm mb-4">A csoport és a csoport ranglista véglegesen törlődik. Ez a művelet nem vonható vissza.</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="delete-confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="showDeleteConfirm = false"
          >
            Mégse
          </button>
          <button
            data-testid="delete-confirm-ok"
            class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium"
            @click="onConfirmDelete"
          >
            Törlés
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { GroupMember, LeaderboardEntry, ScoringConfigInput, SpecialTypeInput, Team, StatPredictionTemplate, GlobalTypeWithSubscription } from '../types/index.js'

type Tab = 'leaderboard' | 'members' | 'settings' | 'special'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const groupId = route.params.id as string
const entries = ref<LeaderboardEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<Tab>('leaderboard')

// ─── Teams (for team_select input type) ─────────────────────────────────────
const teams = ref<Team[]>([])
const teamsLoaded = ref(false)
const teamsMap = computed(() => {
  const map = new Map<string, Team>()
  for (const t of teams.value) map.set(t.id, t)
  return map
})

async function loadTeamsIfNeeded(): Promise<void> {
  if (teamsLoaded.value) return
  try {
    const token = await getAccessToken()
    teams.value = await api.teams.list(token)
    teamsLoaded.value = true
  } catch { /* ignore */ }
}

function teamName(teamId: string): string {
  return teamsMap.value.get(teamId)?.name ?? teamId
}
const confirmRemoveUserId = ref<string | null>(null)

const groupName = computed(() => groupsStore.groups.find(g => g.id === groupId)?.name ?? 'Csoport')
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
  typeDraft.inputType = tpl.inputType
  typeDraft.optionsRaw = tpl.options?.join(', ') ?? ''
  typeDraft.points = tpl.defaultPoints
  editingTypeId.value = null
  typeFormError.value = null
  showTypeForm.value = true
  if (tpl.inputType === 'team_select') loadTeamsIfNeeded()
}

const typeDraft = reactive({
  name: '',
  description: '',
  inputType: 'text' as 'text' | 'dropdown' | 'team_select',
  optionsRaw: '',
  points: 5,
  deadline: '',
})

const specialTypes = computed(() => groupsStore.specialTypesMap[groupId] ?? [])

// ─── Set correct answer dialog ───────────────────────────────────────────────
const setAnswerTypeId = ref<string | null>(null)
const setAnswerTypeName = ref('')
const setAnswerInputType = ref<string>('text')
const setAnswerValue = ref('')
const setAnswerSaving = ref(false)
const setAnswerError = ref<string | null>(null)

// ─── Special predictions (member) ────────────────────────────────────────────
const specialPredictions = computed(() => groupsStore.specialPredictionsMap[groupId] ?? [])
const pendingAnswers = reactive<Record<string, string>>({})
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
  { key: 'exactScore', label: 'Pontos találat' },
  { key: 'correctWinnerAndDiff', label: 'Helyes győztes + gólkülönbség' },
  { key: 'correctWinner', label: 'Helyes győztes' },
  { key: 'correctDraw', label: 'Döntetlen tipp döntetlenre' },
  { key: 'correctOutcome', label: 'Outcome bónusz (hossz./tizenegyes)' },
  { key: 'incorrect', label: 'Helytelen tipp' },
]

type ScoringDraft = {
  exactScore: number
  correctWinnerAndDiff: number
  correctWinner: number
  correctDraw: number
  correctOutcome: number
  incorrect: number
}

const scoringDraft = reactive<ScoringDraft>({
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
})

watch(
  () => groupsStore.groupScoringConfigs[groupId],
  (cfg) => {
    if (!cfg) return
    scoringDraft.exactScore = cfg.exactScore
    scoringDraft.correctWinnerAndDiff = cfg.correctWinnerAndDiff
    scoringDraft.correctWinner = cfg.correctWinner
    scoringDraft.correctDraw = cfg.correctDraw
    scoringDraft.correctOutcome = cfg.correctOutcome
    scoringDraft.incorrect = cfg.incorrect
  },
  { immediate: true },
)

async function submitScoringConfig(): Promise<void> {
  await groupsStore.setGroupScoringConfig(groupId, { ...scoringDraft })
}

function setCopiedInvite(type: 'code' | 'url'): void {
  copiedInvite.value = type
  setTimeout(() => { copiedInvite.value = null }, 2000)
}

async function onToggleAdmin(member: GroupMember): Promise<void> {
  await groupsStore.toggleMemberAdmin(groupId, member.userId, !member.isAdmin)
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
  return new Date(iso).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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

function onInputTypeChange(): void {
  if (typeDraft.inputType === 'team_select') loadTeamsIfNeeded()
}

function openEditType(st: { id: string; name: string; description: string | null; inputType: string; options: string[] | null; points: number; deadline: string }): void {
  editingTypeId.value = st.id
  typeDraft.name = st.name
  typeDraft.description = st.description ?? ''
  typeDraft.inputType = st.inputType as 'text' | 'dropdown' | 'team_select'
  typeDraft.optionsRaw = st.options?.join(', ') ?? ''
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
    typeFormError.value = err instanceof Error ? err.message : 'Hiba'
  } finally {
    typeFormSaving.value = false
  }
}

async function onConfirmDeactivate(): Promise<void> {
  if (!confirmDeactivateTypeId.value) return
  const id = confirmDeactivateTypeId.value
  confirmDeactivateTypeId.value = null
  await groupsStore.deactivateSpecialType(groupId, id)
}

function openSetAnswer(st: { id: string; name: string; inputType: string }): void {
  setAnswerTypeId.value = st.id
  setAnswerTypeName.value = st.name
  setAnswerInputType.value = st.inputType
  setAnswerValue.value = ''
  setAnswerError.value = null
  if (st.inputType === 'team_select') loadTeamsIfNeeded()
}

async function submitSetAnswer(): Promise<void> {
  if (!setAnswerTypeId.value || !setAnswerValue.value.trim()) return
  setAnswerSaving.value = true
  setAnswerError.value = null
  try {
    await groupsStore.setSpecialTypeAnswer(groupId, setAnswerTypeId.value, setAnswerValue.value.trim())
    setAnswerTypeId.value = null
  } catch (err) {
    setAnswerError.value = err instanceof Error ? err.message : 'Hiba'
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
  if (sp.points !== null) return sp.points > 0 ? `+${sp.points}` : '0 pont'
  if (isDeadlinePassed(sp.deadline)) return 'Kiértékelésre vár'
  if (sp.answer) return 'Leadva'
  return 'Nyitott'
}

function canSubmitPrediction(sp: { typeId: string; answer: string | null }): boolean {
  const pending = pendingAnswers[sp.typeId]
  if (!pending) return false
  if (!pending.trim()) return false
  return pending.trim() !== (sp.answer ?? '')
}

async function submitPrediction(typeId: string): Promise<void> {
  const answer = pendingAnswers[typeId]?.trim()
  if (!answer) return
  predictionSaveStatus[typeId] = 'saving'
  try {
    await groupsStore.upsertSpecialPrediction(groupId, { typeId, answer })
    predictionSaveStatus[typeId] = 'saved'
    delete pendingAnswers[typeId]
    setTimeout(() => { predictionSaveStatus[typeId] = 'idle' }, 2000)
  } catch {
    predictionSaveStatus[typeId] = 'error'
  }
}

async function switchToSpecialTab(): Promise<void> {
  activeTab.value = 'special'
  if (!groupsStore.specialPredictionsMap[groupId]) {
    await groupsStore.fetchSpecialPredictions(groupId)
  }
  const preds = groupsStore.specialPredictionsMap[groupId] ?? []
  if (preds.some(p => p.inputType === 'team_select')) {
    await loadTeamsIfNeeded()
  }
}

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
      await loadTemplatesIfNeeded()
      const types = groupsStore.specialTypesMap[groupId] ?? []
      if (types.some(t => t.inputType === 'team_select')) {
        await loadTeamsIfNeeded()
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isLoading.value = false
  }
})
</script>
