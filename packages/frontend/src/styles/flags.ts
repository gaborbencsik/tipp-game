/* Tournament flag tree-shaker.
 *
 * `flag-icons/css/flag-icons.min.css` carries 271 country selectors and
 * 542 SVG references (4x3 + 1x1), totalling ~5.4 MB on a cold load.
 * Hungary VB 2026 + the friendlies only need 48 countries, so we:
 *   1. ship a tiny base stylesheet (`./flags.css`)
 *   2. statically import only the 4x3 SVGs we use, letting Vite hash
 *      and emit them as ~10 KB assets, and
 *   3. inject one `.fi-xx { background-image: url(<hash>.svg) }` rule
 *      per code at runtime.
 *
 * The `?url` query makes Vite return the asset URL string and tree-shake
 * everything else from `flag-icons/flags/4x3/`.
 */

import './flags.css'

import ar from 'flag-icons/flags/4x3/ar.svg?url'
import at from 'flag-icons/flags/4x3/at.svg?url'
import au from 'flag-icons/flags/4x3/au.svg?url'
import ba from 'flag-icons/flags/4x3/ba.svg?url'
import be from 'flag-icons/flags/4x3/be.svg?url'
import br from 'flag-icons/flags/4x3/br.svg?url'
import ca from 'flag-icons/flags/4x3/ca.svg?url'
import cd from 'flag-icons/flags/4x3/cd.svg?url'
import ch from 'flag-icons/flags/4x3/ch.svg?url'
import ci from 'flag-icons/flags/4x3/ci.svg?url'
import co from 'flag-icons/flags/4x3/co.svg?url'
import cv from 'flag-icons/flags/4x3/cv.svg?url'
import cw from 'flag-icons/flags/4x3/cw.svg?url'
import cz from 'flag-icons/flags/4x3/cz.svg?url'
import de from 'flag-icons/flags/4x3/de.svg?url'
import dz from 'flag-icons/flags/4x3/dz.svg?url'
import ec from 'flag-icons/flags/4x3/ec.svg?url'
import eg from 'flag-icons/flags/4x3/eg.svg?url'
import es from 'flag-icons/flags/4x3/es.svg?url'
import fr from 'flag-icons/flags/4x3/fr.svg?url'
import gbEng from 'flag-icons/flags/4x3/gb-eng.svg?url'
import gbSct from 'flag-icons/flags/4x3/gb-sct.svg?url'
import gh from 'flag-icons/flags/4x3/gh.svg?url'
import hr from 'flag-icons/flags/4x3/hr.svg?url'
import ht from 'flag-icons/flags/4x3/ht.svg?url'
import iq from 'flag-icons/flags/4x3/iq.svg?url'
import ir from 'flag-icons/flags/4x3/ir.svg?url'
import jo from 'flag-icons/flags/4x3/jo.svg?url'
import jp from 'flag-icons/flags/4x3/jp.svg?url'
import kr from 'flag-icons/flags/4x3/kr.svg?url'
import ma from 'flag-icons/flags/4x3/ma.svg?url'
import mx from 'flag-icons/flags/4x3/mx.svg?url'
import nl from 'flag-icons/flags/4x3/nl.svg?url'
import no from 'flag-icons/flags/4x3/no.svg?url'
import nz from 'flag-icons/flags/4x3/nz.svg?url'
import pa from 'flag-icons/flags/4x3/pa.svg?url'
import pt from 'flag-icons/flags/4x3/pt.svg?url'
import py from 'flag-icons/flags/4x3/py.svg?url'
import qa from 'flag-icons/flags/4x3/qa.svg?url'
import sa from 'flag-icons/flags/4x3/sa.svg?url'
import se from 'flag-icons/flags/4x3/se.svg?url'
import sn from 'flag-icons/flags/4x3/sn.svg?url'
import tn from 'flag-icons/flags/4x3/tn.svg?url'
import tr from 'flag-icons/flags/4x3/tr.svg?url'
import us from 'flag-icons/flags/4x3/us.svg?url'
import uy from 'flag-icons/flags/4x3/uy.svg?url'
import uz from 'flag-icons/flags/4x3/uz.svg?url'
import za from 'flag-icons/flags/4x3/za.svg?url'

const FLAGS: Readonly<Record<string, string>> = {
  ar, at, au, ba, be, br, ca, cd, ch, ci, co, cv, cw, cz, de, dz,
  ec, eg, es, fr, 'gb-eng': gbEng, 'gb-sct': gbSct, gh, hr, ht, iq,
  ir, jo, jp, kr, ma, mx, nl, no, nz, pa, pt, py, qa, sa, se, sn,
  tn, tr, us, uy, uz, za,
}

const css = Object.entries(FLAGS)
  .map(([code, url]) => `.fi-${code}{background-image:url(${url})}`)
  .join('\n')

const styleEl = document.createElement('style')
styleEl.dataset.source = 'flag-icons-tournament'
styleEl.textContent = css
document.head.appendChild(styleEl)
