<template>
  <div class="lp">

    <!-- NAV -->
    <nav class="lp-nav" :class="{ 'lp-nav--scrolled': navScrolled }">
      <div class="lp-container">
        <div class="lp-nav__inner">
          <a href="#" class="lp-nav__logo">
            <div class="lp-nav__logo-icon">⚽</div>
            VB Tippjáték
          </a>
          <ul class="lp-nav__links">
            <li><a href="#hogyan">{{ $t('landing.navHow') }}</a></li>
            <li><a href="#funkciok">{{ $t('landing.navFeatures') }}</a></li>
            <li><a href="#faq">{{ $t('landing.navFaq') }}</a></li>
          </ul>
          <div class="lp-nav__ctas">
            <router-link to="/login" class="lp-nav__login">{{ $t('landing.navLogin') }}</router-link>
            <router-link to="/login" class="lp-btn-primary lp-nav__cta">{{ $t('landing.navRegister') }}</router-link>
          </div>
          <button class="lp-nav__ham" :aria-label="$t('landing.menuAria')" @click="mobMenuOpen = true">☰</button>
        </div>
      </div>
    </nav>

    <!-- Mobile drawer -->
    <div v-if="mobMenuOpen" class="lp-mob-menu">
      <div class="lp-mob-backdrop" @click="mobMenuOpen = false"></div>
      <div class="lp-mob-drawer">
        <div class="lp-mob-drawer__top">
          <div class="lp-mob-drawer__logo">
            <div class="lp-nav__logo-icon" style="width:26px;height:26px;font-size:0.875rem">⚽</div>
            VB Tippjáték
          </div>
          <button class="lp-mob-close" @click="mobMenuOpen = false">✕</button>
        </div>
        <div class="lp-mob-nav">
          <a class="lp-mob-nav__item" href="#hogyan" @click="mobMenuOpen = false">{{ $t('landing.mobileNavHow') }}</a>
          <a class="lp-mob-nav__item" href="#funkciok" @click="mobMenuOpen = false">{{ $t('landing.mobileNavFeatures') }}</a>
          <a class="lp-mob-nav__item" href="#faq" @click="mobMenuOpen = false">{{ $t('landing.mobileNavFaq') }}</a>
        </div>
        <div class="lp-mob-drawer__cta">
          <router-link to="/login" @click="mobMenuOpen = false" class="lp-mob-drawer__primary">{{ $t('landing.mobileNavRegister') }}</router-link>
          <router-link to="/login" @click="mobMenuOpen = false" class="lp-mob-drawer__secondary">{{ $t('landing.mobileNavLogin') }}</router-link>
        </div>
      </div>
    </div>

    <!-- HERO -->
    <section class="lp-hero" id="ertesites">
      <div class="lp-container">
        <div class="lp-hero__inner">
          <div>
            <div class="lp-hero__badge">{{ $t('landing.heroBadge') }}</div>
            <h1 class="lp-hero__title">{{ $t('landing.heroTitle1') }}<br><em>{{ $t('landing.heroTitle2') }}</em></h1>
            <p class="lp-hero__sub">{{ $t('landing.heroDesc') }}</p>
            <div class="lp-hero__cta-row">
              <router-link to="/login" class="lp-btn-primary lp-hero__primary">{{ $t('landing.heroCtaPrimary') }}</router-link>
              <router-link to="/login" class="lp-hero__secondary">{{ $t('landing.heroCtaSecondary') }}</router-link>
            </div>
            <ul class="lp-hero__bullets">
              <li><span class="lp-hero__bullet-dot"></span>{{ $t('landing.heroBullet1') }}</li>
              <li><span class="lp-hero__bullet-dot"></span>{{ $t('landing.heroBullet2') }}</li>
              <li><span class="lp-hero__bullet-dot"></span>{{ $t('landing.heroBullet3') }}</li>
            </ul>
          </div>

          <!-- Phone mockup -->
          <div class="lp-hero__phone-wrap">
            <div style="position:relative;display:inline-block">
              <div class="lp-phone-float lp-phone-float--a">
                <span class="lp-phone-float__val">+3 pt</span>
                <span class="lp-phone-float__lbl">{{ $t('landing.mockLastTip') }}</span>
              </div>
              <div class="lp-phone">
                <div class="lp-phone__bar"><div class="lp-phone__bar-pill"></div></div>
                <div class="lp-phone__body">
                  <div class="lp-phone__toprow">
                    <div class="lp-phone__logo">VB<span>Tipp</span></div>
                    <div class="lp-phone__avatar">🧑</div>
                  </div>
                  <div class="lp-phone__tabs">
                    <div class="lp-phone__tab lp-phone__tab--active">{{ $t('landing.mockMatches') }}</div>
                    <div class="lp-phone__tab">{{ $t('landing.mockLeaderboard') }}</div>
                  </div>
                  <div class="lp-phone__date">2026. június 14., szombat</div>
                  <div class="lp-phone__match">
                    <div class="lp-phone__match-row">
                      <span class="lp-phone__team">🇧🇷 Brazília</span>
                      <span class="lp-phone__score">2–0</span>
                      <span class="lp-phone__team lp-phone__team--r">Szerbia 🇷🇸</span>
                    </div>
                    <div class="lp-phone__tip">🔒 Tippem: 2–0 &nbsp;<span class="lp-phone__pts">{{ $t('landing.mockPoints') }}</span></div>
                  </div>
                  <div class="lp-phone__match lp-phone__match--fav">
                    <div class="lp-phone__match-row">
                      <span class="lp-phone__team">🇭🇺 Magyarország ❤️</span>
                      <span class="lp-phone__score lp-phone__score--time">17:00</span>
                      <span class="lp-phone__team lp-phone__team--r">Japán 🇯🇵</span>
                    </div>
                    <div class="lp-phone__tip">🔒 Tippem: 1–1 <span class="lp-phone__fav">{{ $t('landing.mockFavBadge') }}</span></div>
                  </div>
                  <div class="lp-phone__match-upcoming">
                    <div class="lp-phone__upcoming-top">
                      <span class="lp-phone__upcoming-teams">🇵🇹 Portugália — 🇫🇷 Franciaország</span>
                      <span class="lp-phone__upcoming-time">⏰ 20:45</span>
                    </div>
                    <div class="lp-phone__tip-input">
                      <div class="lp-phone__inp">2</div>
                      <span class="lp-phone__inp-sep">–</span>
                      <div class="lp-phone__inp">1</div>
                      <div class="lp-phone__save">{{ $t('landing.mockSave') }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="lp-phone-float lp-phone-float--b">
                <span class="lp-phone-float__val">×2</span>
                <span class="lp-phone-float__lbl">{{ $t('landing.mockFavBadge') }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- HOW -->
    <section class="lp-section lp-section--bg" id="hogyan">
      <div class="lp-container">
        <div class="lp-section__head">
          <p class="lp-section__label">{{ $t('landing.howBadge') }}</p>
          <h2 class="lp-section__title">{{ $t('landing.howTitle') }}</h2>
          <p class="lp-section__sub">{{ $t('landing.howDesc') }}</p>
        </div>
        <div class="lp-how-steps">
          <div class="lp-how-step fade-up">
            <div class="lp-step__num">1</div>
            <div class="lp-step__body">
              <h3>{{ $t('landing.howStep1Title') }}</h3>
              <p>{{ $t('landing.howStep1Desc') }}</p>
            </div>
          </div>
          <div class="lp-how-step fade-up">
            <div class="lp-step__num">2</div>
            <div class="lp-step__body">
              <h3>{{ $t('landing.howStep2Title') }}</h3>
              <p>{{ $t('landing.howStep2Desc') }}</p>
            </div>
          </div>
          <div class="lp-how-step fade-up">
            <div class="lp-step__num">3</div>
            <div class="lp-step__body">
              <h3>{{ $t('landing.howStep3Title') }}</h3>
              <p>{{ $t('landing.howStep3Desc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- FEATURES -->
    <section class="lp-section" id="funkciok">
      <div class="lp-container">
        <div class="lp-section__head">
          <p class="lp-section__label">{{ $t('landing.featuresBadge') }}</p>
          <h2 class="lp-section__title">{{ $t('landing.featuresTitle') }}</h2>
          <p class="lp-section__sub">{{ $t('landing.featuresDesc') }}</p>
        </div>
        <div class="lp-feat-grid">
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">👥</div>
            <h3>{{ $t('landing.feature1Title') }}</h3>
            <p>{{ $t('landing.feature1Desc') }}</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">🏆</div>
            <h3>{{ $t('landing.feature2Title') }}</h3>
            <p>{{ $t('landing.feature2Desc') }}</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">❤️</div>
            <h3>{{ $t('landing.feature3Title') }}</h3>
            <p>{{ $t('landing.feature3Desc') }}</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">📊</div>
            <h3>{{ $t('landing.feature4Title') }}</h3>
            <p>{{ $t('landing.feature4Desc') }}</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">⚠️</div>
            <h3>{{ $t('landing.feature5Title') }}</h3>
            <p>{{ $t('landing.feature5Desc') }}</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">📈</div>
            <h3>{{ $t('landing.feature6Title') }}</h3>
            <p>{{ $t('landing.feature6Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- PERSONAS -->
    <section class="lp-section lp-section--bg">
      <div class="lp-container">
        <div class="lp-section__head">
          <p class="lp-section__label">{{ $t('landing.personasBadge') }}</p>
          <h2 class="lp-section__title">{{ $t('landing.personasTitle') }}</h2>
        </div>
        <div class="lp-persona-grid">
          <div class="lp-persona lp-persona--featured fade-up">
            <div class="lp-persona__emoji">👨‍👩‍👧‍👦</div>
            <h3>{{ $t('landing.persona1Title') }}</h3>
            <blockquote>{{ $t('landing.persona1Quote') }}</blockquote>
            <p class="lp-persona__detail">{{ $t('landing.persona1Desc') }}</p>
          </div>
          <div class="lp-persona fade-up">
            <div class="lp-persona__emoji">🏢</div>
            <h3>{{ $t('landing.persona2Title') }}</h3>
            <blockquote>{{ $t('landing.persona2Quote') }}</blockquote>
            <p class="lp-persona__detail">{{ $t('landing.persona2Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- SCORING -->
    <section class="lp-section">
      <div class="lp-container">
        <div class="lp-scoring-grid">
          <div>
            <div class="lp-section__head">
              <p class="lp-section__label">{{ $t('landing.scoringBadge') }}</p>
              <h2 class="lp-section__title">{{ $t('landing.scoringTitle') }}</h2>
              <p class="lp-section__sub">{{ $t('landing.scoringDesc') }}</p>
            </div>
            <div class="lp-score-rules">
              <div class="lp-score-row"><div class="lp-score-pts lp-score-pts--top">3</div><div class="lp-score-desc"><strong>{{ $t('landing.scoringExact') }}</strong><span>{{ $t('landing.scoringExactDesc') }}</span></div></div>
              <div class="lp-score-row"><div class="lp-score-pts">2</div><div class="lp-score-desc"><strong>{{ $t('landing.scoringGoalDiff') }}</strong><span>{{ $t('landing.scoringGoalDiffDesc') }}</span></div></div>
              <div class="lp-score-row"><div class="lp-score-pts">1</div><div class="lp-score-desc"><strong>{{ $t('landing.scoringWinner') }}</strong><span>{{ $t('landing.scoringWinnerDesc') }}</span></div></div>
              <div class="lp-score-row"><div class="lp-score-pts lp-score-pts--zero">0</div><div class="lp-score-desc"><strong>{{ $t('landing.scoringWrong') }}</strong><span>{{ $t('landing.scoringWrongDesc') }}</span></div></div>
            </div>
            <p class="lp-score-note">{{ $t('landing.scoringDoubleNote') }}</p>
          </div>
          <div class="lp-lb fade-up">
            <div class="lp-lb__head">
              <div class="lp-lb__title">🏆 Ranglista</div>
              <small>Osztálytársak 2026</small>
            </div>
            <div class="lp-lb__row"><div class="lp-lb__pos lp-lb__pos--1">🥇</div><div class="lp-lb__avatar">👨</div><div class="lp-lb__name">Kovács Péter</div><div class="lp-lb__change lp-lb__change--up">▲2</div><div class="lp-lb__pts">42</div></div>
            <div class="lp-lb__row lp-lb__row--me"><div class="lp-lb__pos lp-lb__pos--me">2</div><div class="lp-lb__avatar lp-lb__avatar--me">🎯</div><div class="lp-lb__name lp-lb__name--me">Te</div><div class="lp-lb__change lp-lb__change--up">▲1</div><div class="lp-lb__pts lp-lb__pts--me">38</div></div>
            <div class="lp-lb__row"><div class="lp-lb__pos">3</div><div class="lp-lb__avatar">👩</div><div class="lp-lb__name">Nagy Dóra</div><div class="lp-lb__change lp-lb__change--dn">▼1</div><div class="lp-lb__pts">35</div></div>
            <div class="lp-lb__row"><div class="lp-lb__pos">4</div><div class="lp-lb__avatar">🧑</div><div class="lp-lb__name">Szabó Bence</div><div class="lp-lb__change">—</div><div class="lp-lb__pts">29</div></div>
            <div class="lp-lb__row"><div class="lp-lb__pos">5</div><div class="lp-lb__avatar">👩‍🦰</div><div class="lp-lb__name">Tóth Réka</div><div class="lp-lb__change lp-lb__change--dn">▼2</div><div class="lp-lb__pts">18</div></div>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- COMMUNITY / CTA strip -->
    <section class="lp-community">
      <div class="lp-container">
        <div class="lp-community__avatars">
          <div class="lp-av">👨</div><div class="lp-av">👩</div><div class="lp-av">🧑</div><div class="lp-av">👨‍🦱</div><div class="lp-av">👩‍🦰</div>
        </div>
        <h2 class="lp-community__title">{{ $t('landing.communityTitle') }}</h2>
        <p class="lp-community__text">{{ $t('landing.communityText') }}</p>
        <router-link to="/login" class="lp-btn-primary lp-community__cta">{{ $t('landing.communityCta') }}</router-link>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- FAQ -->
    <section class="lp-section lp-section--bg" id="faq">
      <div class="lp-container">
        <div class="lp-section__head lp-section__head--center">
          <p class="lp-section__label">{{ $t('landing.faqBadge') }}</p>
          <h2 class="lp-section__title">{{ $t('landing.faqTitle') }}</h2>
        </div>
        <div class="lp-faq">
          <div v-for="(item, idx) in faqs" :key="idx" class="lp-faq__item">
            <button class="lp-faq__q" :class="{ 'lp-faq__q--open': activeFaq === idx }" @click="toggleFaq(idx)">
              {{ item.q }}
              <span class="lp-faq__icon">+</span>
            </button>
            <div class="lp-faq__a" :class="{ 'lp-faq__a--open': activeFaq === idx }">{{ item.a }}</div>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- FOOTER CTA -->
    <footer class="lp-footer">
      <div class="lp-container">
        <p class="lp-section__label">{{ $t('landing.footerCtaTitle') }}</p>
        <h2 class="lp-section__title">{{ $t('landing.footerCtaDesc1') }} <em class="lp-em">{{ $t('landing.footerCtaDesc2') }}</em></h2>
        <div class="lp-footer__cta-row">
          <router-link to="/login" class="lp-btn-primary lp-footer__primary">{{ $t('landing.footerCtaPrimary') }}</router-link>
          <router-link to="/login" class="lp-footer__secondary">{{ $t('landing.footerCtaSecondary') }}</router-link>
        </div>
        <p class="lp-footer__microcopy">{{ $t('landing.footerCtaDisclaimer') }}</p>
        <div class="lp-footer__links">
          <span class="lp-footer__brand">{{ $t('landing.footerBrand') }}</span>
          <a href="https://ko-fi.com/" target="_blank" rel="noopener noreferrer">{{ $t('landing.footerKofi') }}</a>
          <a href="#">{{ $t('landing.footerPrivacy') }}</a>
        </div>
        <p class="lp-footer__copy">{{ $t('landing.footerCopyright') }}</p>
      </div>
    </footer>

    <!-- STICKY BOTTOM CTA (csak mobilon) -->
    <div class="lp-sticky-cta" :class="{ 'lp-sticky-cta--visible': stickyCta }">
      <div class="lp-sticky-cta__text">
        <span class="lp-sticky-cta__label">{{ $t('landing.stickyBrand') }}</span>
        <span class="lp-sticky-cta__sub">{{ $t('landing.stickyDesc') }}</span>
      </div>
      <router-link to="/login" class="lp-sticky-cta__btn">{{ $t('landing.stickyRegister') }}</router-link>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const navScrolled = ref(false)
const mobMenuOpen = ref(false)
const activeFaq = ref<number | null>(null)
const stickyCta = ref(false)

const faqs = computed(() => [
  { q: t('landing.faq1Q'), a: t('landing.faq1A') },
  { q: t('landing.faq2Q'), a: t('landing.faq2A') },
  { q: t('landing.faq3Q'), a: t('landing.faq3A') },
  { q: t('landing.faq4Q'), a: t('landing.faq4A') },
  { q: t('landing.faq5Q'), a: t('landing.faq5A') },
  { q: t('landing.faq6Q'), a: t('landing.faq6A') },
])

let heroEl: HTMLElement | null = null

function onScroll(): void {
  navScrolled.value = window.scrollY > 10
  if (heroEl) {
    stickyCta.value = heroEl.getBoundingClientRect().bottom < 0
  }
}

function toggleFaq(idx: number): void {
  activeFaq.value = activeFaq.value === idx ? null : idx
}

onMounted(() => {
  heroEl = document.getElementById('ertesites')
  window.addEventListener('scroll', onScroll, { passive: true })
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) }
    }),
    { threshold: 0.08 },
  )
  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el))
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style>
.lp,
:root {
  --lp-blue:      #4361EE;
  --lp-blue-h:    #3451D1;
  --lp-blue-lt:   #EEF2FF;
  --lp-blue-mid:  #C7D2FE;
  --lp-text:      #111827;
  --lp-text-2:    #6B7280;
  --lp-text-3:    #9CA3AF;
  --lp-border:    #E5E7EB;
  --lp-border-2:  #D1D5DB;
  --lp-bg:        #FFFFFF;
  --lp-bg-2:      #F9FAFB;
  --lp-bg-3:      #F3F4F6;
  --lp-green:     #059669;
  --lp-green-lt:  #ECFDF5;
  --lp-red:       #DC2626;
  --lp-red-lt:    #FEF2F2;
  --lp-red-mid:   #FCA5A5;
  --lp-r:         12px;
  --lp-r-sm:      8px;
  --lp-shadow:    0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --lp-shadow-md: 0 8px 24px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.06);
}

.lp {
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--lp-text);
  background: var(--lp-bg);
  -webkit-font-smoothing: antialiased;
  font-size: 16px;
  line-height: 1.6;
  padding-bottom: env(safe-area-inset-bottom);
}
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp a { color: inherit; text-decoration: none; }
.lp button { font-family: inherit; cursor: pointer; border: none; background: none; }
.lp img { display: block; max-width: 100%; }
.lp h1, .lp h2, .lp h3 { margin: 0; }
.lp p { margin: 0; }
.lp ul { margin: 0; padding: 0; list-style: none; }

/* CONTAINER */
.lp-container { width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
@media (min-width: 640px) { .lp-container { padding: 0 2rem; } }
@media (min-width: 1024px) { .lp-container { padding: 0 2.5rem; } }

/* BUTTON */
.lp-btn-primary,
a.lp-btn-primary,
button.lp-btn-primary {
  display: inline-block;
  background: var(--lp-blue) !important;
  color: #fff !important;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.7rem 1.25rem;
  border-radius: var(--lp-r-sm);
  border: none;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  white-space: nowrap;
  text-decoration: none !important;
  -webkit-tap-highlight-color: transparent;
}
.lp-btn-primary:hover,
a.lp-btn-primary:hover,
button.lp-btn-primary:hover { background: var(--lp-blue-h) !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(67,97,238,0.35); }
button.lp-btn-primary:active { transform: scale(0.98); }

/* NAV */
.lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--lp-border);
  transition: box-shadow 0.2s;
}
.lp-nav--scrolled { box-shadow: 0 1px 12px rgba(0,0,0,0.08); }
.lp-nav__inner { height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.lp-nav__logo { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.95rem; color: var(--lp-text); }
.lp-nav__logo-icon { width: 30px; height: 30px; background: var(--lp-blue); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; flex-shrink: 0; }
.lp-nav__links { display: none; gap: 1.5rem; font-size: 0.875rem; font-weight: 500; color: var(--lp-text-2); }
.lp-nav__links a:hover { color: var(--lp-text); }
.lp-nav__ctas { display: none; align-items: center; gap: 0.5rem; }
.lp-nav__login { font-size: 0.875rem; font-weight: 500; color: var(--lp-text-2); padding: 0.45rem 0.6rem; border-radius: 6px; transition: color 0.15s, background 0.15s; }
.lp-nav__login:hover { color: var(--lp-text); background: var(--lp-bg-2); }
.lp-nav__cta { font-size: 0.875rem !important; padding: 0.45rem 1rem !important; border-radius: 8px !important; }
.lp-nav__ham {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.25rem; color: var(--lp-text-2);
  transition: background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.lp-nav__ham:hover { background: var(--lp-bg-2); }
@media (min-width: 768px) {
  .lp-nav__links { display: flex; }
  .lp-nav__ctas { display: inline-flex; }
  .lp-nav__ham { display: none; }
}

/* MOBILE DRAWER */
.lp-mob-menu { position: fixed; inset: 0; z-index: 300; }
.lp-mob-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  animation: lp-fd-in 0.2s ease;
}
@keyframes lp-fd-in { from { opacity: 0; } to { opacity: 1; } }
.lp-mob-drawer {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: min(80vw, 320px); background: var(--lp-bg);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  display: flex; flex-direction: column;
  animation: lp-dr-in 0.25s cubic-bezier(0.25,0.46,0.45,0.94);
}
@keyframes lp-dr-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
.lp-mob-drawer__top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--lp-border);
}
.lp-mob-drawer__logo { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.95rem; }
.lp-mob-close {
  width: 34px; height: 34px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; color: var(--lp-text-2);
  -webkit-tap-highlight-color: transparent;
}
.lp-mob-close:hover { background: var(--lp-bg-2); }
.lp-mob-nav { padding: 1rem 0.75rem; flex: 1; }
.lp-mob-nav__item {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.75rem; border-radius: 10px;
  font-size: 0.95rem; font-weight: 500; color: var(--lp-text-2);
  margin-bottom: 2px;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s, color 0.12s;
}
.lp-mob-nav__item:hover { background: var(--lp-bg-2); color: var(--lp-text); }
.lp-mob-drawer__cta { padding: 1.25rem; border-top: 1px solid var(--lp-border); display: flex; flex-direction: column; gap: 0.625rem; }
.lp-mob-drawer__primary {
  display: block; background: var(--lp-blue) !important; color: #fff !important;
  font-weight: 600; font-size: 1rem; text-align: center;
  padding: 0.875rem; border-radius: 10px;
  -webkit-tap-highlight-color: transparent;
}
.lp-mob-drawer__primary:active { background: var(--lp-blue-h) !important; }
.lp-mob-drawer__secondary {
  display: block; text-align: center;
  padding: 0.75rem; border-radius: 10px;
  font-size: 0.95rem; color: var(--lp-text-2);
  border: 1px solid var(--lp-border);
}

/* HERO */
.lp-hero {
  padding-top: clamp(5rem, 18vw, 8rem);
  padding-bottom: clamp(2.5rem, 8vw, 5rem);
  background: linear-gradient(160deg, var(--lp-bg-2) 0%, var(--lp-bg) 60%);
  overflow: hidden;
}
.lp-hero__inner { display: block; }
.lp-hero__badge { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--lp-blue-lt); color: var(--lp-blue); font-size: 0.75rem; font-weight: 700; padding: 0.3rem 0.8rem; border-radius: 100px; margin-bottom: 1.1rem; border: 1px solid var(--lp-blue-mid); letter-spacing: 0.03em; }
.lp-hero__title { font-size: clamp(2.1rem, 8vw, 3.8rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 1.5rem !important; color: var(--lp-text); }
.lp-hero__title em { font-style: normal; color: var(--lp-blue); display: block; }
.lp-hero__sub { font-size: clamp(0.95rem, 3vw, 1.1rem); color: var(--lp-text-2); line-height: 1.65; margin-bottom: 1.75rem !important; }
/* CTA row + bullets */
.lp-hero__cta-row { display: flex; flex-direction: column; align-items: stretch; gap: 0.75rem; margin-bottom: 1rem; }
.lp-hero__primary { width: 100%; min-height: 50px; font-size: 1rem !important; font-weight: 700 !important; padding: 0.875rem 1.25rem !important; text-align: center; }
.lp-hero__secondary { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0.6rem 1rem; font-size: 0.9rem; font-weight: 500; color: var(--lp-text-2); border-radius: var(--lp-r-sm); border: 1px solid var(--lp-border-2); transition: background 0.12s, color 0.12s; }
.lp-hero__secondary:hover { background: var(--lp-bg-2); color: var(--lp-text); }
.lp-hero__bullets { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; color: var(--lp-text-3); }
.lp-hero__bullets li { display: flex; align-items: center; gap: 0.5rem; }
.lp-hero__bullet-dot { width: 5px; height: 5px; background: var(--lp-green); border-radius: 50%; flex-shrink: 0; }
@media (min-width: 480px) {
  .lp-hero__cta-row { flex-direction: row; align-items: center; }
  .lp-hero__primary { width: auto; }
  .lp-hero__bullets { flex-direction: row; flex-wrap: wrap; gap: 0.875rem; }
}

/* Phone mockup */
.lp-hero__phone-wrap { display: flex; justify-content: center; margin-top: 2.5rem; position: relative; }
.lp-phone {
  width: min(280px, 80vw);
  background: var(--lp-bg);
  border: 1px solid var(--lp-border);
  border-radius: 22px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 0 0 6px rgba(255,255,255,0.6);
  overflow: hidden;
  position: relative; z-index: 2;
}
.lp-phone__bar { height: 32px; background: var(--lp-bg-2); border-bottom: 1px solid var(--lp-border); display: flex; align-items: center; justify-content: center; }
.lp-phone__bar-pill { width: 60px; height: 6px; background: var(--lp-border-2); border-radius: 3px; }
.lp-phone__body { padding: 0.875rem; }
.lp-phone__toprow { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.875rem; }
.lp-phone__logo { font-size: 0.8rem; font-weight: 700; color: var(--lp-text); }
.lp-phone__logo span { color: var(--lp-blue); }
.lp-phone__avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--lp-blue-lt); border: 2px solid var(--lp-blue-mid); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.lp-phone__tabs { display: flex; gap: 0.375rem; margin-bottom: 0.875rem; }
.lp-phone__tab { font-size: 0.68rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 6px; color: var(--lp-text-3); }
.lp-phone__tab--active { background: var(--lp-blue); color: #fff; }
.lp-phone__date { font-size: 0.65rem; font-weight: 700; color: var(--lp-text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
.lp-phone__match { background: var(--lp-bg-2); border: 1px solid var(--lp-border); border-radius: 8px; padding: 0.625rem 0.75rem; margin-bottom: 0.4rem; }
.lp-phone__match--fav { background: var(--lp-red-lt); border-color: var(--lp-red-mid); }
.lp-phone__match-row { display: flex; align-items: center; gap: 0.375rem; font-size: 0.73rem; font-weight: 600; margin-bottom: 0.3rem; }
.lp-phone__team { flex: 1; color: var(--lp-text); }
.lp-phone__team--r { text-align: right; }
.lp-phone__score { font-size: 0.85rem; font-weight: 800; color: var(--lp-text); flex-shrink: 0; }
.lp-phone__score--time { font-size: 0.78rem; color: var(--lp-text-2); }
.lp-phone__tip { font-size: 0.62rem; color: var(--lp-text-2); display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
.lp-phone__pts { font-size: 0.62rem; font-weight: 700; color: var(--lp-green); background: var(--lp-green-lt); padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #BBF7D0; }
.lp-phone__fav { font-size: 0.6rem; font-weight: 700; color: var(--lp-red); background: #fff; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid var(--lp-red-mid); }
.lp-phone__match-upcoming { background: var(--lp-blue-lt); border: 1px solid var(--lp-blue-mid); border-radius: 8px; padding: 0.625rem 0.75rem; }
.lp-phone__upcoming-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.lp-phone__upcoming-teams { font-size: 0.68rem; font-weight: 600; color: var(--lp-text); }
.lp-phone__upcoming-time { font-size: 0.65rem; font-weight: 700; color: var(--lp-blue); white-space: nowrap; }
.lp-phone__tip-input { display: flex; align-items: center; gap: 0.3rem; }
.lp-phone__inp { width: 1.8rem; height: 1.5rem; border: 1px solid var(--lp-blue-mid); border-radius: 4px; background: var(--lp-bg); font-size: 0.75rem; font-weight: 700; text-align: center; color: var(--lp-text); display: flex; align-items: center; justify-content: center; }
.lp-phone__inp-sep { font-size: 0.75rem; font-weight: 700; color: var(--lp-text-3); }
.lp-phone__save { margin-left: auto; background: var(--lp-blue); color: #fff; font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.45rem; border-radius: 4px; }
/* Floating badges */
.lp-phone-float { position: absolute; background: var(--lp-bg); border: 1px solid var(--lp-border); border-radius: 10px; box-shadow: var(--lp-shadow); padding: 0.5rem 0.75rem; white-space: nowrap; font-size: 0.75rem; z-index: 3; }
.lp-phone-float__val { font-weight: 700; color: var(--lp-blue); font-size: 1rem; display: block; line-height: 1.1; }
.lp-phone-float__lbl { color: var(--lp-text-3); font-size: 0.65rem; }
.lp-phone-float--a { top: 1rem; right: -2.5rem; }
.lp-phone-float--b { bottom: 2rem; left: -2.5rem; }
.lp-phone-float--b .lp-phone-float__val { color: var(--lp-red); }
@media (max-width: 420px) { .lp-phone-float--a, .lp-phone-float--b { display: none; } }
/* Desktop: 2-column hero */
@media (min-width: 900px) {
  .lp-hero__inner { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
  .lp-hero__phone-wrap { margin-top: 0; }
  .lp-hero__title em { display: inline; }
}

/* SECTIONS */
.lp-section { padding: clamp(3.5rem, 9vw, 6rem) 0; }
.lp-section--bg { background: var(--lp-bg-2); }
.lp-section__label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lp-blue); margin-bottom: 0.4rem; }
.lp-section__title { font-size: clamp(1.75rem, 5vw, 2.6rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; margin-bottom: 0.625rem; color: var(--lp-text); }
.lp-section__sub { color: var(--lp-text-2); font-size: clamp(0.9rem, 2.2vw, 1rem); line-height: 1.65; max-width: 520px; }
.lp-section__head { margin-bottom: clamp(1.75rem, 5vw, 3rem); }
.lp-section__head--center { text-align: center; max-width: none; }
.lp-section__head--center .lp-section__label,
.lp-section__head--center .lp-section__title { text-align: center; }
.lp-em { font-style: normal; color: var(--lp-blue); }

/* HOW: vertikális lista mobilon, 3 oszlop desktopon */
.lp-how-steps { display: flex; flex-direction: column; border: 1px solid var(--lp-border); border-radius: 16px; overflow: hidden; }
.lp-how-step { display: flex; align-items: flex-start; gap: 1rem; padding: 1.25rem; border-bottom: 1px solid var(--lp-border); background: var(--lp-bg); }
.lp-how-step:last-child { border-bottom: none; }
.lp-step__num { width: 2.25rem; height: 2.25rem; border-radius: 50%; flex-shrink: 0; background: var(--lp-blue); color: #fff; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(67,97,238,0.3); margin-top: 0.15rem; }
.lp-step__body h3 { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.3rem; color: var(--lp-text); }
.lp-step__body p { font-size: 0.875rem; color: var(--lp-text-2); line-height: 1.6; }
@media (min-width: 640px) {
  .lp-how-steps { flex-direction: row; border: none; background: transparent; border-radius: 0; overflow: visible; }
  .lp-how-step { flex: 1; flex-direction: column; border: 1px solid var(--lp-border); border-radius: var(--lp-r); background: var(--lp-bg); border-bottom: 1px solid var(--lp-border); }
  .lp-how-step:not(:last-child) { margin-right: 1rem; }
}

/* FEATURES */
.lp-feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
@media (max-width: 480px) { .lp-feat-grid { grid-template-columns: 1fr; gap: 0.625rem; } }
@media (min-width: 768px) { .lp-feat-grid { grid-template-columns: repeat(3, 1fr); gap: 0.875rem; } }
.lp-feat-card { background: var(--lp-bg); border: 1px solid var(--lp-border); border-radius: var(--lp-r); padding: 1.25rem; transition: box-shadow 0.2s, border-color 0.15s; }
.lp-feat-card:hover { box-shadow: var(--lp-shadow); border-color: var(--lp-blue-mid); }
.lp-feat-card__icon { width: 2.25rem; height: 2.25rem; border-radius: 8px; background: var(--lp-blue-lt); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin-bottom: 0.875rem; }
.lp-feat-card h3 { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.3rem; color: var(--lp-text); }
.lp-feat-card p { font-size: 0.82rem; color: var(--lp-text-2); line-height: 1.6; }

/* PERSONAS */
.lp-persona-grid { display: grid; grid-template-columns: 1fr; gap: 0.875rem; }
@media (min-width: 560px) { .lp-persona-grid { grid-template-columns: 1fr 1fr; } }
.lp-persona { background: var(--lp-bg); border: 1.5px solid var(--lp-border); border-radius: 16px; padding: 1.5rem; }
.lp-persona--featured { border-color: var(--lp-blue-mid); background: linear-gradient(135deg, #FAFBFF, var(--lp-bg)); }
.lp-persona__emoji { font-size: 2rem; line-height: 1; margin-bottom: 0.75rem; }
.lp-persona h3 { font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem; color: var(--lp-text); }
.lp-persona blockquote { font-style: italic; color: var(--lp-text-2); font-size: 0.9rem; line-height: 1.6; border-left: 3px solid var(--lp-blue-mid); padding-left: 0.875rem; margin-bottom: 0.625rem; margin-top: 0; }
.lp-persona__detail { font-size: 0.82rem; color: var(--lp-text-3); }

/* SCORING */
.lp-scoring-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
@media (min-width: 720px) { .lp-scoring-grid { grid-template-columns: 1fr 1.1fr; gap: 2.5rem; align-items: center; } }
.lp-score-rules { display: flex; flex-direction: column; border: 1px solid var(--lp-border); border-radius: var(--lp-r); overflow: hidden; }
.lp-score-row { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1.1rem; border-bottom: 1px solid var(--lp-border); background: var(--lp-bg); }
.lp-score-row:last-child { border-bottom: none; }
.lp-score-pts { width: 2.25rem; height: 2.25rem; border-radius: 7px; background: var(--lp-blue-lt); color: var(--lp-blue); font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lp-score-pts--top { background: var(--lp-blue); color: #fff; }
.lp-score-pts--zero { background: var(--lp-bg-3); color: var(--lp-text-3); }
.lp-score-desc strong { font-size: 0.875rem; font-weight: 600; color: var(--lp-text); display: block; }
.lp-score-desc span { font-size: 0.78rem; color: var(--lp-text-2); }
.lp-score-note { margin-top: 0.875rem; font-size: 0.82rem; color: var(--lp-text-2); padding: 0.75rem 1rem; background: var(--lp-blue-lt); border: 1px dashed var(--lp-blue-mid); border-radius: var(--lp-r-sm); }

/* LEADERBOARD */
.lp-lb { background: var(--lp-bg); border: 1px solid var(--lp-border); border-radius: var(--lp-r); overflow: hidden; box-shadow: var(--lp-shadow); }
.lp-lb__head { background: var(--lp-bg-2); padding: 0.75rem 1.1rem; border-bottom: 1px solid var(--lp-border); display: flex; align-items: center; justify-content: space-between; }
.lp-lb__title { font-weight: 700; font-size: 0.875rem; color: var(--lp-text); }
.lp-lb__head small { font-size: 0.72rem; color: var(--lp-text-3); }
.lp-lb__row { display: flex; align-items: center; gap: 0.625rem; padding: 0.7rem 1.1rem; border-bottom: 1px solid var(--lp-border); font-size: 0.875rem; }
.lp-lb__row:last-child { border-bottom: none; }
.lp-lb__row--me { background: var(--lp-blue-lt); }
.lp-lb__pos { width: 1.25rem; text-align: center; font-weight: 600; color: var(--lp-text-3); font-size: 0.82rem; }
.lp-lb__pos--1 { color: #F59E0B; }
.lp-lb__pos--me { color: var(--lp-blue); font-weight: 700; }
.lp-lb__avatar { width: 1.875rem; height: 1.875rem; border-radius: 50%; background: var(--lp-bg-3); display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; border: 1.5px solid var(--lp-border); }
.lp-lb__avatar--me { border-color: var(--lp-blue-mid); }
.lp-lb__name { flex: 1; font-weight: 500; color: var(--lp-text); }
.lp-lb__name--me { font-weight: 600; color: var(--lp-blue); }
.lp-lb__pts { font-weight: 700; font-size: 0.9rem; color: var(--lp-text); }
.lp-lb__pts--me { color: var(--lp-blue); }
.lp-lb__change { font-size: 0.7rem; font-weight: 600; width: 1.25rem; text-align: center; color: var(--lp-text-3); }
.lp-lb__change--up { color: #059669; }
.lp-lb__change--dn { color: #DC2626; }

/* COMMUNITY (CTA strip) */
.lp-community { padding: clamp(3rem, 8vw, 5rem) 0; text-align: center; background: linear-gradient(135deg, var(--lp-blue-lt), #EEF4FF); }
.lp-community__avatars { display: flex; justify-content: center; margin-bottom: 1rem; }
.lp-av { width: 2.5rem; height: 2.5rem; border-radius: 50%; border: 2.5px solid #fff; background: var(--lp-bg-3); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin-left: -0.625rem; }
.lp-av:first-child { margin-left: 0; }
.lp-community__title { font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 800; letter-spacing: -0.02em; color: var(--lp-text); margin-bottom: 0.5rem; }
.lp-community__text { color: var(--lp-text-2); font-size: 0.975rem; max-width: 480px; margin: 0 auto 1.25rem; }
.lp-community__cta { font-size: 1rem !important; padding: 0.875rem 1.75rem !important; }

/* FAQ – körös + ikon */
.lp-faq { max-width: 640px; margin: 0 auto; }
.lp-faq__item { border-bottom: 1px solid var(--lp-border); }
.lp-faq__q {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 0.875rem; color: var(--lp-text);
  font-size: 0.95rem; font-weight: 600; text-align: left;
  padding: 1.1rem 0; min-height: 52px;
  transition: color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.lp-faq__q:hover, .lp-faq__q--open { color: var(--lp-blue); }
.lp-faq__icon {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--lp-bg-2); border: 1px solid var(--lp-border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 1rem; line-height: 1; color: var(--lp-text-3);
  transition: transform 0.25s, background 0.15s, border-color 0.15s;
}
.lp-faq__q--open .lp-faq__icon { transform: rotate(45deg); background: var(--lp-blue-lt); border-color: var(--lp-blue-mid); color: var(--lp-blue); }
.lp-faq__a { overflow: hidden; max-height: 0; transition: max-height 0.35s ease, padding-bottom 0.3s; padding-bottom: 0; font-size: 0.9rem; color: var(--lp-text-2); line-height: 1.7; }
.lp-faq__a--open { max-height: 320px; padding-bottom: 1.25rem; }

/* FOOTER */
.lp-footer { padding: clamp(3rem, 9vw, 5.5rem) 0 2.5rem; border-top: 1px solid var(--lp-border); text-align: center; }
.lp-footer__cta-row { display: flex; flex-direction: column; gap: 0.625rem; max-width: 360px; margin: 1.5rem auto 0.625rem; align-items: stretch; }
.lp-footer__primary { width: 100%; min-height: 50px; font-size: 1rem !important; font-weight: 700 !important; padding: 0.875rem 1.25rem !important; text-align: center; }
.lp-footer__secondary { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0.6rem 1rem; font-size: 0.9rem; font-weight: 500; color: var(--lp-text-2); border-radius: var(--lp-r-sm); border: 1px solid var(--lp-border-2); }
.lp-footer__secondary:hover { background: var(--lp-bg-2); color: var(--lp-text); }
@media (min-width: 480px) {
  .lp-footer__cta-row { flex-direction: row; justify-content: center; max-width: none; }
  .lp-footer__primary { width: auto; }
}
.lp-footer__microcopy { font-size: 0.75rem; color: var(--lp-text-3); margin-top: 0.5rem; }
.lp-footer__links { display: flex; justify-content: center; flex-wrap: wrap; gap: 1.25rem; margin-top: 2.25rem; font-size: 0.8rem; color: var(--lp-text-3); }
.lp-footer__links a:hover { color: var(--lp-text); }
.lp-footer__brand { font-weight: 600; color: var(--lp-text); }
.lp-footer__copy { margin-top: 1.25rem; font-size: 0.75rem; color: var(--lp-text-3); }
@media (max-width: 639px) { .lp-footer { padding-bottom: 6rem; } }

/* DIVIDER */
.lp-divider { height: 1px; background: var(--lp-border); }

/* STICKY BOTTOM CTA (csak mobilon) */
.lp-sticky-cta {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 150;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--lp-border);
  padding: 0.875rem 1.25rem;
  padding-bottom: calc(0.875rem + env(safe-area-inset-bottom));
  transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94);
  display: flex; align-items: center; gap: 0.75rem;
}
.lp-sticky-cta--visible { transform: translateY(0); }
.lp-sticky-cta__text { flex: 1; }
.lp-sticky-cta__label { font-size: 0.8rem; font-weight: 700; color: var(--lp-text); display: block; }
.lp-sticky-cta__sub { font-size: 0.7rem; color: var(--lp-text-3); }
.lp-sticky-cta__btn {
  display: inline-flex; align-items: center;
  background: var(--lp-blue) !important; color: #fff !important;
  font-weight: 700; font-size: 0.875rem;
  padding: 0.7rem 1.1rem; border-radius: 8px;
  white-space: nowrap; min-height: 44px;
  text-decoration: none !important;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, transform 0.1s;
  flex-shrink: 0; line-height: 1.4;
}
.lp-sticky-cta__btn:active { background: var(--lp-blue-h) !important; transform: scale(0.97); }
@media (min-width: 640px) { .lp-sticky-cta { display: none; } }

/* FADE-UP ANIM */
.lp .fade-up { opacity: 0; transform: translateY(18px); transition: opacity 0.55s ease, transform 0.55s ease; }
.lp .fade-up.visible { opacity: 1; transform: translateY(0); }
.lp .fade-up:nth-child(1) { transition-delay: 0.04s; }
.lp .fade-up:nth-child(2) { transition-delay: 0.1s; }
.lp .fade-up:nth-child(3) { transition-delay: 0.16s; }
.lp .fade-up:nth-child(4) { transition-delay: 0.22s; }
</style>
