function c(s,n){const e=String(s||"").trim(),t=String(n||"").trim();return e+(t?`
`+t:"")}function o(s){const n=String(s||"").trim();if(!n)return{purchase:"-",vendor:"-"};if(n.includes(`
`)){const[r,...i]=n.split(`
`);return{purchase:r.trim()||"-",vendor:i.join(`
`).trim()||"-"}}const e=n.split(" · "),t=e.find(r=>r.startsWith("Bahan: ")),a=e.find(r=>r.startsWith("Pemasok: "));return{purchase:t?t.slice(7):n,vendor:a?a.slice(9):"-"}}export{c as f,o as p};
