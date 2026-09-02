// booking picker - keep End after Start and show a live total.
// The server re-checks all of this; this is only to stop obviously wrong submissions.
(() => {
  'use strict'

  const form = document.querySelector('.booking-form')
  if (!form) return

  const startSel = document.getElementById('startMin')
  const endSel = document.getElementById('endMin')
  const totalEl = document.getElementById('bookingTotal')
  const pricePerHour = Number(form.dataset.price) || 0
  const block = Number(form.dataset.block) || 30

  const refresh = () => {
    const start = Number(startSel.value)
    // an end time at or before the start makes no sense, so hide those options
    let firstValid = null
    Array.from(endSel.options).forEach(opt => {
      const bad = Number(opt.value) <= start
      opt.disabled = bad
      opt.hidden = bad
      if (!bad && firstValid === null) firstValid = opt.value
    })
    if (Number(endSel.value) <= start && firstValid !== null) {
      endSel.value = firstValid
    }

    const mins = Number(endSel.value) - start
    const total = mins > 0 ? Math.round((mins / 60) * pricePerHour) : 0
    totalEl.textContent = '₹' + total.toLocaleString('en-IN')
  }

  startSel.addEventListener('change', refresh)
  endSel.addEventListener('change', refresh)
  refresh()
})()

// tax switch - toggles every listing price between nightly and nightly + 18% GST
// leading ; is required: this file omits semicolons, so without it the previous
// IIFE's `})()` runs straight into this `(` and JS treats it as a function call
;(() => {
  'use strict'

  const taxSwitch = document.getElementById('switchCheckDefault')
  if (!taxSwitch) return

  taxSwitch.addEventListener('click', () => {
    document.querySelectorAll('.price-amount').forEach(el => {
      // read the original price off the data attribute so repeated toggles cannot compound
      const base = Number(el.dataset.price) || 0
      const value = taxSwitch.checked ? Math.round(base * 1.18) : base
      el.textContent = value.toLocaleString('en-IN')
    })
    document.querySelectorAll('.tax-info').forEach(el => {
      el.style.display = taxSwitch.checked ? 'inline' : 'none'
    })
  })
})()

;(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false)
  })
})()