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
            <li><a href="#hogyan">Hogyan működik?</a></li>
            <li><a href="#funkciok">Funkciók</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <router-link v-if="loginEnabled" to="/login" class="lp-btn-primary lp-nav__cta">Bejelentkezés</router-link>
          <button class="lp-nav__ham" aria-label="Menü" @click="mobMenuOpen = true">☰</button>
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
          <a class="lp-mob-nav__item" href="#hogyan" @click="mobMenuOpen = false">🔢 Hogyan működik?</a>
          <a class="lp-mob-nav__item" href="#funkciok" @click="mobMenuOpen = false">⚡ Funkciók</a>
          <a class="lp-mob-nav__item" href="#faq" @click="mobMenuOpen = false">❓ FAQ</a>
        </div>
        <div class="lp-mob-drawer__cta">
          <router-link v-if="loginEnabled" to="/login" @click="mobMenuOpen = false">Bejelentkezés →</router-link>
        </div>
      </div>
    </div>

    <!-- HERO -->
    <section class="lp-hero" id="ertesites">
      <div class="lp-container">
        <div class="lp-hero__inner">
          <div>
            <div class="lp-hero__badge">⚽ VB 2026 — Várólista</div>
            <h1 class="lp-hero__title">Foci VB tippverseny a barátaiddal.<br><em>Excel nélkül.</em></h1>
            <p class="lp-hero__sub">Tippeljétek meg a VB meccseit, és egy élő ranglista megmutatja, ki a legjobb — kézi számolgatás nélkül.</p>
            <div v-if="heroSubmitted" class="lp-form-success">
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5 6.5-7" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Feliratkoztál! Értesítünk, amint elindul.
            </div>
            <form v-else class="lp-form-row" @submit.prevent="handleHeroSubmit">
              <input v-model="heroEmail" type="email" placeholder="email-cím..." required autocomplete="email">
              <input type="text" name="website" v-model="honeypot" class="lp-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <button class="lp-btn-primary" type="submit" :disabled="submitting">Értesíts induláskor →</button>
            </form>
            <p v-if="heroError" class="lp-form-error">{{ heroError }}</p>
            <p class="lp-microcopy"><span class="lp-microcopy__dot"></span> Ingyenes. Spam nélkül. Leiratkozhatsz egy kattintással.</p>
          </div>

          <!-- Phone mockup -->
          <div class="lp-hero__phone-wrap">
            <div style="position:relative;display:inline-block">
              <div class="lp-phone-float lp-phone-float--a">
                <span class="lp-phone-float__val">+5 pt</span>
                <span class="lp-phone-float__lbl">utolsó tipp</span>
              </div>
              <div class="lp-phone">
                <div class="lp-phone__bar"><div class="lp-phone__bar-pill"></div></div>
                <div class="lp-phone__body">
                  <div class="lp-phone__toprow">
                    <div class="lp-phone__logo">VB<span>Tipp</span></div>
                    <div class="lp-phone__avatar">🧑</div>
                  </div>
                  <div class="lp-phone__tabs">
                    <div class="lp-phone__tab lp-phone__tab--active">Meccsek</div>
                    <div class="lp-phone__tab">Ranglista</div>
                  </div>
                  <div class="lp-phone__date">2026. június 14., szombat</div>
                  <div class="lp-phone__match">
                    <div class="lp-phone__match-row">
                      <span class="lp-phone__team">🇧🇷 Brazília</span>
                      <span class="lp-phone__score">2–0</span>
                      <span class="lp-phone__team lp-phone__team--r">Szerbia 🇷🇸</span>
                    </div>
                    <div class="lp-phone__tip">🔒 Tippem: 2–0 &nbsp;<span class="lp-phone__pts">+5 pt ✓</span></div>
                  </div>
                  <div class="lp-phone__match">
                    <div class="lp-phone__match-row">
                      <span class="lp-phone__team">🇩🇪 Németország</span>
                      <span class="lp-phone__score lp-phone__score--time">17:00</span>
                      <span class="lp-phone__team lp-phone__team--r">Japán 🇯🇵</span>
                    </div>
                    <div class="lp-phone__tip">🔒 Tippem: 1–1</div>
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
                      <div class="lp-phone__save">Mentés</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="lp-phone-float lp-phone-float--b">
                <span class="lp-phone-float__val">1 247</span>
                <span class="lp-phone-float__lbl">feliratkozott</span>
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
          <p class="lp-section__label">Három lépés</p>
          <h2 class="lp-section__title">Hogyan működik?</h2>
          <p class="lp-section__sub">Nincs Excel-tábla, nincs regisztrációs macera. Csak tipp, pont és verseny.</p>
        </div>
        <div class="lp-how-steps">
          <div class="lp-how-step fade-up">
            <div class="lp-step__num">1</div>
            <div class="lp-step__body">
              <h3>Hozz létre egy csoportot</h3>
              <p>Hívd meg a barátaidat vagy kollégáidat egyedi meghívó kóddal — akár percek alatt.</p>
            </div>
          </div>
          <div class="lp-how-step fade-up">
            <div class="lp-step__num">2</div>
            <div class="lp-step__body">
              <h3>Tippeld meg a meccseket</h3>
              <p>Minden mérkőzés előtt add le a tipped — egyszerű felületen, telefonról is, percek alatt.</p>
            </div>
          </div>
          <div class="lp-how-step fade-up">
            <div class="lp-step__num">3</div>
            <div class="lp-step__body">
              <h3>Kövesd a ranglistát</h3>
              <p>A pontok automatikusan számolódnak, te csak szurkolsz és élvezed a versenyt.</p>
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
          <p class="lp-section__label">Funkciók</p>
          <h2 class="lp-section__title">Minden, amire szükséged van.</h2>
          <p class="lp-section__sub">Semmi felesleg — csak a tipp, a pont, és a verseny.</p>
        </div>
        <div class="lp-feat-grid">
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">⚽</div>
            <h3>Csoportok</h3>
            <p>Privát vagy publikus csoportot hozhatsz létre. A ranglista csak a tagoknak látszik.</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">📊</div>
            <h3>Automatikus pontozás</h3>
            <p>Pontos tipp, helyes győztes, gólkülönbség — minden pontot ér. Azonnal frissül.</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">🔔</div>
            <h3>Meccs előtti figyelmeztetés</h3>
            <p>Nem maradsz le egyetlen tippről sem. Értesítünk, mielőtt a meccs elkezdődik.</p>
          </div>
          <div class="lp-feat-card fade-up">
            <div class="lp-feat-card__icon">🏆</div>
            <h3>Ranglisták</h3>
            <p>Mérd össze magad a különböző társaságaiddal — vagy akár az összes játékossal egyszerre.</p>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- PERSONAS -->
    <section class="lp-section lp-section--bg">
      <div class="lp-container">
        <div class="lp-section__head">
          <p class="lp-section__label">Kinek való?</p>
          <h2 class="lp-section__title">Neked való.</h2>
        </div>
        <div class="lp-persona-grid">
          <div class="lp-persona lp-persona--featured fade-up">
            <div class="lp-persona__emoji">👨‍👩‍👧‍👦</div>
            <h3>Baráti társaságok</h3>
            <blockquote>"Minden VB-n van egy WhatsApp-csoport és egy Excel. Most legyen egy igazi app."</blockquote>
            <p class="lp-persona__detail">Hívd meg a haverjaidat, osszátok meg a kódot, és kezdődjön a tipp-háború.</p>
          </div>
          <div class="lp-persona fade-up">
            <div class="lp-persona__emoji">🏢</div>
            <h3>Munkahelyek</h3>
            <blockquote>"A legjobb csapatépítő, amit a főnök is megenged."</blockquote>
            <p class="lp-persona__detail">Kollégiális verseny, nulla adminisztráció. A HR is meg lesz elégedve.</p>
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
              <p class="lp-section__label">Pontozás</p>
              <h2 class="lp-section__title">Minden tipp számít.</h2>
              <p class="lp-section__sub">Az egyszerű tipptől a pontos végeredményig — a rendszer mindent automatikusan kezel.</p>
            </div>
            <div class="lp-score-rules">
              <div class="lp-score-row"><div class="lp-score-pts lp-score-pts--top">5</div><div class="lp-score-desc"><strong>Pontos végeredmény</strong><span>Telitalálat — a legjobb tipp</span></div></div>
              <div class="lp-score-row"><div class="lp-score-pts">3</div><div class="lp-score-desc"><strong>Helyes gólkülönbség</strong><span>A különbség stimmel</span></div></div>
              <div class="lp-score-row"><div class="lp-score-pts">2</div><div class="lp-score-desc"><strong>Helyes győztes</strong><span>Tudtad, ki nyer</span></div></div>
              <div class="lp-score-row"><div class="lp-score-pts lp-score-pts--zero">0</div><div class="lp-score-desc"><strong>Téves tipp</strong><span>Következő meccs, új esély</span></div></div>
            </div>
          </div>
          <div class="lp-lb fade-up">
            <div class="lp-lb__head">
              <div class="lp-lb__title">🏆 Ranglista</div>
              <small>Osztálytársak 2026</small>
            </div>
            <div class="lp-lb__row"><div class="lp-lb__pos lp-lb__pos--1">🥇</div><div class="lp-lb__avatar">👨</div><div class="lp-lb__name">Kovács Péter</div><div class="lp-lb__change lp-lb__change--up">▲2</div><div class="lp-lb__pts">142</div></div>
            <div class="lp-lb__row lp-lb__row--me"><div class="lp-lb__pos lp-lb__pos--me">2</div><div class="lp-lb__avatar lp-lb__avatar--me">🎯</div><div class="lp-lb__name lp-lb__name--me">Te</div><div class="lp-lb__change lp-lb__change--dn">▼1</div><div class="lp-lb__pts lp-lb__pts--me">138</div></div>
            <div class="lp-lb__row"><div class="lp-lb__pos">3</div><div class="lp-lb__avatar">👩</div><div class="lp-lb__name">Nagy Dóra</div><div class="lp-lb__change lp-lb__change--up">▲1</div><div class="lp-lb__pts">135</div></div>
            <div class="lp-lb__row"><div class="lp-lb__pos">4</div><div class="lp-lb__avatar">🧑</div><div class="lp-lb__name">Szabó Bence</div><div class="lp-lb__change">—</div><div class="lp-lb__pts">129</div></div>
            <div class="lp-lb__row"><div class="lp-lb__pos">5</div><div class="lp-lb__avatar">👩‍🦰</div><div class="lp-lb__name">Tóth Réka</div><div class="lp-lb__change lp-lb__change--dn">▼2</div><div class="lp-lb__pts">118</div></div>
          </div>
        </div>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- COMMUNITY -->
    <section class="lp-community">
      <div class="lp-container">
        <div class="lp-community__avatars">
          <div class="lp-av">👨</div><div class="lp-av">👩</div><div class="lp-av">🧑</div><div class="lp-av">👨‍🦱</div><div class="lp-av">👩‍🦰</div>
        </div>
        <div class="lp-community__number">1 247</div>
        <p class="lp-community__text">ember már feliratkozott a várólistára.</p>
        <p class="lp-community__sub">Csatlakozz te is, mielőtt a VB elindul.</p>
      </div>
    </section>

    <div class="lp-divider"></div>

    <!-- FAQ -->
    <section class="lp-section lp-section--bg" id="faq">
      <div class="lp-container">
        <div class="lp-section__head lp-section__head--center">
          <p class="lp-section__label">Kérdések</p>
          <h2 class="lp-section__title">Amit mindenki kérdez.</h2>
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
        <p class="lp-section__label">Ne maradj le</p>
        <h2 class="lp-section__title">Legyen meg a tipped, <em class="lp-em">mielőtt a VB elindul.</em></h2>
        <div v-if="footerSubmitted" class="lp-form-success lp-footer__success">
          <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5 6.5-7" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Feliratkoztál! Értesítünk, amint elindul.
        </div>
        <form v-else class="lp-footer__form" @submit.prevent="handleFooterSubmit">
          <input v-model="footerEmail" type="email" placeholder="email-cím..." required autocomplete="email">
          <input type="text" name="website" v-model="honeypot" class="lp-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <button class="lp-btn-primary" type="submit" :disabled="submitting">Értesíts →</button>
        </form>
        <p v-if="footerError" class="lp-form-error">{{ footerError }}</p>
        <p class="lp-footer__microcopy">Ingyenes. Spam nélkül. Leiratkozhatsz egy kattintással.</p>
        <div class="lp-footer__links">
          <a href="#">⚽ VB Tippjáték</a>
          <a href="#">Twitter / X</a>
          <a href="#">Facebook</a>
          <a href="#">Ko-fi ☕ Támogass</a>
          <a href="#">Adatvédelem</a>
        </div>
        <p class="lp-footer__copy">© 2025–2026 VB Tippjáték · Nem áll kapcsolatban a FIFA-val.</p>
      </div>
    </footer>

    <!-- STICKY BOTTOM CTA (csak mobilon) -->
    <div v-if="loginEnabled" class="lp-sticky-cta" :class="{ 'lp-sticky-cta--visible': stickyCta }">
      <div class="lp-sticky-cta__text">
        <span class="lp-sticky-cta__label">⚽ VB 2026 Tippjáték</span>
        <span class="lp-sticky-cta__sub">Ingyenes · Egy kattintásos belépés</span>
      </div>
      <router-link to="/login" class="lp-sticky-cta__btn">Bejelentkezés →</router-link>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/index.js'

const route = useRoute()
const loginEnabled = computed(() => route.query['force_enable_login'] === 'true')

const navScrolled = ref(false)
const mobMenuOpen = ref(false)
const activeFaq = ref<number | null>(null)
const heroSubmitted = ref(false)
const footerSubmitted = ref(false)
const stickyCta = ref(false)

const heroEmail = ref('')
const footerEmail = ref('')
const honeypot = ref('')
const submitting = ref(false)
const heroError = ref('')
const footerError = ref('')
let mountedAt = 0

const faqs = [
  { q: 'Ingyenes a VB Tippjáték?', a: 'Igen, teljesen ingyenes. Nem kell fizetni semmit — sem a csoportért, sem a ranglistáért.' },
  { q: 'Kell külön regisztrálni?', a: 'Nem. Google-fiókoddal egy kattintással bejelentkezhetsz — nincs jelszó, nincs hosszú regisztrációs folyamat.' },
  { q: 'Mobilon is működik?', a: 'Igen, böngészőből mobilon is tökéletesen elérhető. Az app mobilra optimalizált, külön letöltés nélkül.' },
  { q: 'Mikor indul el az app?', a: 'A VB 2026 előtt. Iratkozz fel a várólistára — értesítünk emailben, amint megnyílik a regisztráció.' },
  { q: 'Kell focit érteni a tippeléshez?', a: 'Egyáltalán nem. Elég, ha szurkolsz — vagy ha csak nyerni akarsz a barátaidnál.' },
]

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

async function handleHeroSubmit(): Promise<void> {
  heroError.value = ''
  submitting.value = true
  try {
    const elapsed = Date.now() - mountedAt
    await api.waitlist.subscribe(heroEmail.value, 'hero', honeypot.value, elapsed)
    heroSubmitted.value = true
    stickyCta.value = false
  } catch (err) {
    heroError.value = err instanceof Error ? err.message : 'Hiba történt. Próbáld újra később.'
  } finally {
    submitting.value = false
  }
}

async function handleFooterSubmit(): Promise<void> {
  footerError.value = ''
  submitting.value = true
  try {
    const elapsed = Date.now() - mountedAt
    await api.waitlist.subscribe(footerEmail.value, 'footer', honeypot.value, elapsed)
    footerSubmitted.value = true
  } catch (err) {
    footerError.value = err instanceof Error ? err.message : 'Hiba történt. Próbáld újra később.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  mountedAt = Date.now()
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
.lp ul { margin: 0; padding: 0; }

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
.lp-nav__links { display: none; gap: 1.5rem; list-style: none; font-size: 0.875rem; font-weight: 500; color: var(--lp-text-2); }
.lp-nav__links a:hover { color: var(--lp-text); }
.lp-nav__cta { display: none !important; font-size: 0.875rem !important; padding: 0.45rem 1rem !important; border-radius: 8px !important; }
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
  .lp-nav__cta { display: inline-block !important; }
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
.lp-mob-drawer__cta { padding: 1.25rem; border-top: 1px solid var(--lp-border); }
.lp-mob-drawer__cta a {
  display: block; background: var(--lp-blue) !important; color: #fff !important;
  font-weight: 600; font-size: 1rem; text-align: center;
  padding: 0.875rem; border-radius: 10px;
  -webkit-tap-highlight-color: transparent;
}
.lp-mob-drawer__cta a:active { background: var(--lp-blue-h) !important; }

/* HERO */
.lp-hero {
  padding-top: clamp(5rem, 18vw, 8rem);
  padding-bottom: clamp(2.5rem, 8vw, 5rem);
  background: linear-gradient(160deg, var(--lp-bg-2) 0%, var(--lp-bg) 60%);
  overflow: hidden;
}
.lp-hero__inner { display: block; }
.lp-hero__badge { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--lp-blue-lt); color: var(--lp-blue); font-size: 0.75rem; font-weight: 700; padding: 0.3rem 0.8rem; border-radius: 100px; margin-bottom: 1.1rem; border: 1px solid var(--lp-blue-mid); letter-spacing: 0.03em; }
.lp-hero__title { font-size: clamp(2.1rem, 8vw, 3.8rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 2.25rem !important; color: var(--lp-text); }
.lp-hero__title em { font-style: normal; color: var(--lp-blue); display: block; }
.lp-hero__sub { font-size: clamp(0.95rem, 3vw, 1.1rem); color: var(--lp-text-2); line-height: 1.65; margin-bottom: 2.25rem !important; }
/* Form: stacked mobile, row desktop */
.lp-form-row { display: flex; flex-direction: column; gap: 0.625rem; margin-bottom: 0.875rem; }
.lp-form-row input[type="email"] { width: 100%; padding: 0.875rem 1.1rem; border: 1.5px solid var(--lp-border-2); border-radius: var(--lp-r-sm); font-size: 16px; color: var(--lp-text); background: var(--lp-bg); outline: none; transition: border-color 0.15s; min-height: 50px; }
.lp-form-row input::placeholder { color: var(--lp-text-3); }
.lp-form-row input:focus { border-color: var(--lp-blue); box-shadow: 0 0 0 3px rgba(67,97,238,0.12); }
.lp-form-row .lp-btn-primary { width: 100%; min-height: 50px; font-size: 1rem !important; font-weight: 700 !important; }
@media (min-width: 480px) {
  .lp-form-row { flex-direction: row; }
  .lp-form-row input[type="email"] { flex: 1; }
  .lp-form-row .lp-btn-primary { width: auto; }
}
.lp-microcopy { font-size: 0.78rem; color: var(--lp-text-3); margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem; }
.lp-microcopy__dot { width: 5px; height: 5px; background: var(--lp-green); border-radius: 50%; flex-shrink: 0; }

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
.lp-phone__match-row { display: flex; align-items: center; gap: 0.375rem; font-size: 0.73rem; font-weight: 600; margin-bottom: 0.3rem; }
.lp-phone__team { flex: 1; color: var(--lp-text); }
.lp-phone__team--r { text-align: right; }
.lp-phone__score { font-size: 0.85rem; font-weight: 800; color: var(--lp-text); flex-shrink: 0; }
.lp-phone__score--time { font-size: 0.78rem; color: var(--lp-text-2); }
.lp-phone__tip { font-size: 0.62rem; color: var(--lp-text-2); display: flex; align-items: center; gap: 0.3rem; }
.lp-phone__pts { font-size: 0.62rem; font-weight: 700; color: var(--lp-green); background: var(--lp-green-lt); padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #BBF7D0; }
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

/* COMMUNITY */
.lp-community { padding: 3rem 0; text-align: center; background: linear-gradient(135deg, var(--lp-blue-lt), #EEF4FF); }
.lp-community__avatars { display: flex; justify-content: center; margin-bottom: 0.875rem; }
.lp-av { width: 2.5rem; height: 2.5rem; border-radius: 50%; border: 2.5px solid #fff; background: var(--lp-bg-3); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin-left: -0.625rem; }
.lp-av:first-child { margin-left: 0; }
.lp-community__number { font-size: clamp(3.5rem, 12vw, 6rem); font-weight: 800; color: var(--lp-blue); letter-spacing: -0.03em; line-height: 1; margin-bottom: 0.375rem; }
.lp-community__text { color: var(--lp-text-2); font-size: 0.975rem; }
.lp-community__sub { color: var(--lp-text-3); font-size: 0.82rem; margin-top: 0.3rem; }

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
.lp-faq__a--open { max-height: 240px; padding-bottom: 1.25rem; }

/* FOOTER */
.lp-footer { padding: clamp(3rem, 9vw, 5.5rem) 0 2.5rem; border-top: 1px solid var(--lp-border); text-align: center; }
.lp-footer__form { display: flex; flex-direction: column; gap: 0.625rem; max-width: 460px; margin: 1.5rem auto 0.625rem; }
.lp-footer__form input { width: 100%; padding: 0.875rem 1rem; min-height: 50px; border: 1.5px solid var(--lp-border-2); border-radius: var(--lp-r-sm); font-size: 16px; color: var(--lp-text); background: var(--lp-bg); outline: none; transition: border-color 0.15s; }
.lp-footer__form input:focus { border-color: var(--lp-blue); box-shadow: 0 0 0 3px rgba(67,97,238,0.1); }
.lp-footer__form input::placeholder { color: var(--lp-text-3); }
.lp-footer__form .lp-btn-primary { width: 100%; min-height: 50px; }
@media (min-width: 480px) {
  .lp-footer__form { flex-direction: row; }
  .lp-footer__form input { flex: 1; }
  .lp-footer__form .lp-btn-primary { width: auto; }
}
.lp-footer__microcopy { font-size: 0.75rem; color: var(--lp-text-3); margin-top: 0.25rem; }
.lp-footer__links { display: flex; justify-content: center; flex-wrap: wrap; gap: 1.25rem; margin-top: 2.25rem; font-size: 0.8rem; color: var(--lp-text-3); }
.lp-footer__links a:hover { color: var(--lp-text); }
.lp-footer__copy { margin-top: 1.25rem; font-size: 0.75rem; color: var(--lp-text-3); }
.lp-footer__success { max-width: 460px; margin: 1.5rem auto 0; justify-content: center; }
@media (max-width: 639px) { .lp-footer { padding-bottom: 6rem; } }

/* FORM SUCCESS */
.lp-form-success { display: flex; align-items: center; gap: 0.6rem; background: var(--lp-green-lt); border: 1px solid #BBF7D0; color: var(--lp-green); font-weight: 600; font-size: 0.9rem; padding: 0.85rem 1rem; border-radius: var(--lp-r-sm); margin-bottom: 0.625rem; }

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
  display: inline-block;
  background: var(--lp-blue) !important; color: #fff !important;
  font-weight: 700; font-size: 0.875rem;
  padding: 0.7rem 1.1rem; border-radius: 8px;
  white-space: nowrap; min-height: 44px;
  text-decoration: none !important;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, transform 0.1s;
  flex-shrink: 0; line-height: 1.4;
  display: flex; align-items: center;
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

/* HONEYPOT – hidden from real users */
.lp-hp { position: absolute !important; left: -9999px; width: 1px; height: 1px; overflow: hidden; opacity: 0; }

/* FORM ERROR */
.lp-form-error { color: #DC2626; font-size: 0.82rem; margin-top: 0.35rem; }
</style>
