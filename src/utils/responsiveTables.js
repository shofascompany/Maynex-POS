/**
 * On phones every `.table` is shown as a list of cards (see styles/main.css).
 * Each card row needs to know its column name, so this copies the header text
 * of every column onto its cells as `data-label`. It watches the page so tables
 * that appear or change later are labelled too.
 */
export function autoLabelTables(root = document.body) {
  let queued = false

  function label() {
    queued = false
    for (const table of root.querySelectorAll('table.table')) {
      const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
      if (!heads.length) continue
      for (const tr of table.querySelectorAll('tbody tr')) {
        let col = 0
        for (const td of tr.children) {
          const text = heads[col] || ''
          if (td.dataset.label !== text) td.dataset.label = text
          col += td.colSpan || 1
        }
      }
    }
  }

  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(label)
  }

  // only structural changes matter; attribute changes (including ours) are ignored
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true })
  schedule()
}
