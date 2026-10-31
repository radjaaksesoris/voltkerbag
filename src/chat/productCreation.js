import { unitFactor } from '../productUnits.js'

function isSkip(text) {
  return /^(lewati|skip)(\s+(foto|kategori))?$|^(tidak ada|tidak punya|belum ada)(\s+foto)?$|^nanti$/i.test(String(text).trim())
}

function parseQuantity(text) {
  const match = String(text).match(/\d[\d.,]*/)
  if (!match) return null
  const groups = match[0].split(/[.,]/)
  if (groups.length > 1 && groups.slice(1).some((group) => group.length !== 3)) return null
  const value = Number(match[0].replace(/[.,]/g, ''))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function parseRupiah(text) {
  const value = String(text).toLocaleLowerCase('id-ID')
  const match = value.match(/\d[\d.,]*/)
  if (!match) return null
  const multiplier = /\b(juta|jt)\b/.test(value)
    ? 1_000_000
    : /\b(ribu|rb)\b/.test(value)
      ? 1_000
      : 1
  const numberText = multiplier > 1 && match[0].includes(',')
    ? match[0].replace(/\./g, '').replace(',', '.')
    : match[0].replace(/[.,]/g, '')
  const number = Number(numberText)
  const amount = number * multiplier
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

export function startProductCreationRequest(text) {
  if (!/\b(?:buat(?:kan)?|bikin|tambah(?:kan)?|daftarkan|input)\b.*\b(?:produk|barang|stok)\s+baru\b/i.test(text)) {
    return null
  }
  const name = text.match(/\bnama(?:nya)?\s+(.+)$/i)?.[1]?.replace(/[,.!?;]+$/, '').trim() || ''
  return {
    name,
    step: name ? 'photo' : 'name',
    image: null
  }
}

export function startStockAdditionRequest(text) {
  const match = String(text).match(/\b(?:tambah(?:kan)?|menambah(?:kan)?|isi)\s+stok\b(.*)$/i)
  if (!match || /^\s*(?:baru|produk baru)\b/i.test(match[1])) return null
  const product = match[1]
    .replace(/^\s*(?:(?:untuk)\s+)?(?:produk|barang)\s+/i, '')
    .replace(/^\s*untuk\s+/i, '')
    .replace(/\b(?:dong|tolong|ya|untuk produk)$/i, '')
    .replace(/[,.!?;]+$/, '')
    .trim()
  return {
    kind: 'stock_addition',
    product,
    step: 'product'
  }
}

export function stockAdditionPrompt(addition) {
  if (addition.step === 'product') return 'Produk mana yang ingin ditambahkan stoknya?'
  const factor = unitFactor(addition.unit)
  const oldAverageCost = Number(addition.current?.average_cost) * factor
  const previousPrices = addition.unit === 'lusin'
    ? 'Harga jual saat ini: PCS ' + formatRupiah(addition.current?.sale_prices?.pcs) +
      ' · lusin ' + formatRupiah(addition.current?.sale_prices?.lusin) + '.'
    : 'Harga jual saat ini: ' + addition.unit + ' ' + formatRupiah(addition.current?.sale_prices?.[addition.unit]) + '.'
  const currentInfo = [
    addition.current?.stock ? 'Stok saat ini: ' + addition.current.stock + '.' : '',
    Number.isFinite(oldAverageCost) ? 'Modal rata-rata saat ini: ' + formatRupiah(oldAverageCost) + '/' + addition.unit + '.' : '',
    previousPrices
  ].filter(Boolean).join(' ')
  if (addition.step === 'quantity') {
    return 'Baik, saya akan menambahkan stok ' + addition.product + '. ' + currentInfo +
      ' Berapa jumlah stok yang ingin ditambahkan dalam ' + addition.unit + '?'
  }
  if (addition.step === 'unit_cost') {
    return currentInfo + ' Berapa harga modal batch baru per ' + addition.unit + '?'
  }
  if (addition.step === 'price_policy') {
    return 'Harga modal batch yang baru: ' + formatRupiah(addition.unitCost) + '/' + addition.unit +
      '. ' + previousPrices + ' Apakah harga jual ingin diganti? Balas "ganti" untuk memasukkan harga baru, atau "tetap" untuk mempertahankan harga lama.'
  }
  if (addition.step === 'sale_price_pcs') {
    return 'Harga jual PCS sebelumnya ' + formatRupiah(addition.current?.sale_prices?.pcs) +
      '. Berapa harga jual PCS yang baru?'
  }
  if (addition.step === 'sale_price_lusin') {
    return 'Harga jual lusin sebelumnya ' + formatRupiah(addition.current?.sale_prices?.lusin) +
      '. Berapa harga jual lusin yang baru?'
  }
  return 'Harga jual ' + addition.unit + ' sebelumnya ' +
    formatRupiah(addition.current?.sale_prices?.[addition.unit]) + '. Berapa harga jual ' + addition.unit + ' yang baru?'
}

function formatRupiah(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0
    ? 'Rp' + amount.toLocaleString('id-ID')
    : 'belum tersedia'
}

function completeStockAddition(addition, pricePolicy) {
  return {
    complete: true,
    actionArgs: {
      product: addition.product,
      quantity: addition.quantity,
      unit: addition.unit,
      unit_cost: addition.unitCost,
      pricePolicy,
      ...(pricePolicy === 'replace' && addition.sale_price_pcs != null
        ? { sale_price_pcs: addition.sale_price_pcs, sale_price_lusin: addition.sale_price_lusin }
        : {}),
      ...(pricePolicy === 'replace' && addition.sale_price != null
        ? { sale_price: addition.sale_price }
        : {})
    }
  }
}

export function advanceStockAddition(addition, text) {
  const answer = String(text).trim()
  if (/^(batal|batalkan|cancel)$/i.test(answer)) return { cancelled: true }
  if (addition.step === 'product') {
    if (!answer) return { addition, prompt: stockAdditionPrompt(addition) }
    return { addition: { ...addition, product: answer }, resolveProduct: true }
  }
  if (addition.step === 'quantity') {
    const quantity = parseQuantity(answer)
    if (quantity == null) {
      return { addition, prompt: 'Jumlah stok harus bilangan bulat lebih dari nol. Berapa jumlah stok yang ingin ditambahkan dalam ' + addition.unit + '?' }
    }
    const next = { ...addition, quantity, step: 'unit_cost' }
    return { addition: next, prompt: stockAdditionPrompt(next) }
  }
  if (addition.step === 'unit_cost') {
    const unitCost = parseRupiah(answer)
    if (unitCost == null) {
      return { addition, prompt: stockAdditionPrompt(addition) }
    }
    const next = { ...addition, unitCost, step: 'price_policy' }
    return { addition: next, prompt: stockAdditionPrompt(next) }
  }
  if (addition.step === 'price_policy') {
    if (/\b(tetap|pakai yang lama|gunakan yang lama|pertahankan|jangan diganti)\b/i.test(answer)
        || /^(tidak|nggak|enggak)$/i.test(answer)) {
      return completeStockAddition(addition, 'keep')
    }
    if (!/\b(ganti|ubah|diganti|sesuaikan|harga baru)\b/i.test(answer)
        && !/^(ya|iya)$/i.test(answer)) {
      return { addition, prompt: stockAdditionPrompt(addition) }
    }
    const next = {
      ...addition,
      step: addition.unit === 'pcs' || addition.unit === 'lusin' ? 'sale_price_pcs' : 'sale_price'
    }
    return { addition: next, prompt: stockAdditionPrompt(next) }
  }
  if (addition.step === 'sale_price_pcs') {
    const price = parseRupiah(answer)
    if (price == null) return { addition, prompt: stockAdditionPrompt(addition) }
    const next = { ...addition, sale_price_pcs: price, step: 'sale_price_lusin' }
    return { addition: next, prompt: stockAdditionPrompt(next) }
  }
  if (addition.step === 'sale_price_lusin') {
    const price = parseRupiah(answer)
    if (price == null) return { addition, prompt: stockAdditionPrompt(addition) }
    return completeStockAddition({ ...addition, sale_price_lusin: price }, 'replace')
  }
  const price = parseRupiah(answer)
  if (price == null) return { addition, prompt: stockAdditionPrompt(addition) }
  return completeStockAddition({ ...addition, sale_price: price }, 'replace')
}

export function productCreationPrompt(creation) {
  if (creation.step === 'name') return 'Baik, saya bantu buatkan stok baru. Apa nama produknya?'
  if (creation.step === 'photo') {
    return 'Baik, saya akan membuatkan stok baru dengan nama ' + creation.name +
      '. Silakan unggah foto produk melalui tombol +. Jika belum ada, balas "lewati foto".'
  }
  if (creation.step === 'category') {
    return 'Foto sudah ' + (creation.image ? 'diterima' : 'dilewati') +
      '. Kategori produknya apa? Jika tidak perlu, balas "lewati".'
  }
  if (creation.step === 'unit') return 'Satuan produk ' + creation.name + ' apa? Contoh: pcs, lusin, atau satuan custom yang sudah terdaftar.'
  if (creation.step === 'quantity') {
    const stockUnit = ['pcs', 'lusin'].includes(creation.unit.toLocaleLowerCase('id-ID')) ? 'lusin' : creation.unit
    return 'Berapa jumlah stok awal ' + creation.name + ' dalam ' + stockUnit + '?'
  }
  if (creation.step === 'unit_cost') {
    const costUnit = ['pcs', 'lusin'].includes(creation.unit.toLocaleLowerCase('id-ID')) ? 'lusin' : creation.unit
    return 'Berapa harga modal awal ' + creation.name + ' per ' + costUnit + '?'
  }
  if (creation.step === 'sale_price_pcs') return 'Berapa harga jual ' + creation.name + ' per PCS?'
  if (creation.step === 'sale_price_lusin') return 'Berapa harga jual ' + creation.name + ' per lusin?'
  return 'Berapa harga jual ' + creation.name + ' per ' + creation.unit + '?'
}

export function advanceProductCreation(creation, { text = '', attachment = null } = {}) {
  const answer = String(text).trim()
  if (/^(batal|batalkan|cancel)$/i.test(answer)) return { cancelled: true }

  const next = { ...creation }
  if (creation.step === 'name') {
    if (!answer) return { creation, prompt: 'Nama produk belum disebutkan. Apa nama produknya?' }
    next.name = answer
    next.step = 'photo'
  } else if (creation.step === 'photo') {
    if (attachment?.type?.startsWith('image/')) {
      next.image = attachment
      next.step = 'category'
    } else if (isSkip(answer)) {
      next.step = 'category'
    } else {
      return { creation, prompt: 'Silakan unggah foto melalui tombol + atau balas "lewati foto".' }
    }
  } else if (creation.step === 'category') {
    next.category = isSkip(answer) ? '' : answer
    next.step = 'unit'
  } else if (creation.step === 'unit') {
    if (!answer) return { creation, prompt: 'Satuan produk apa? Contoh: pcs, lusin, atau satuan custom yang sudah terdaftar.' }
    next.unit = answer
    next.step = 'quantity'
  } else if (creation.step === 'quantity') {
    const quantity = parseQuantity(answer)
    if (quantity == null) return { creation, prompt: 'Jumlah stok harus bilangan bulat lebih dari nol. Berapa jumlah stok awalnya?' }
    next.stock_quantity = quantity
    next.step = 'unit_cost'
  } else if (creation.step === 'unit_cost') {
    const cost = parseRupiah(answer)
    if (cost == null) return { creation, prompt: 'Harga modal belum terbaca. Berapa nominal modal awalnya?' }
    next.unit_cost = cost
    next.step = ['pcs', 'lusin'].includes(creation.unit.toLocaleLowerCase('id-ID'))
      ? 'sale_price_pcs'
      : 'sale_price'
  } else if (creation.step === 'sale_price_pcs') {
    const price = parseRupiah(answer)
    if (price == null) return { creation, prompt: 'Harga jual PCS belum terbaca. Berapa nominalnya?' }
    next.sale_price_pcs = price
    next.step = 'sale_price_lusin'
  } else if (creation.step === 'sale_price_lusin') {
    const price = parseRupiah(answer)
    if (price == null) return { creation, prompt: 'Harga jual per lusin belum terbaca. Berapa nominalnya?' }
    next.sale_price_lusin = price
    return {
      complete: true,
      creation: next,
      actionArgs: {
        name: next.name,
        ...(next.category ? { category: next.category } : {}),
        unit: next.unit,
        stock_quantity: next.stock_quantity,
        unit_cost: next.unit_cost,
        sale_price_pcs: next.sale_price_pcs,
        sale_price_lusin: next.sale_price_lusin
      },
      attachment: next.image
    }
  } else {
    const price = parseRupiah(answer)
    if (price == null) return { creation, prompt: 'Harga jual belum terbaca. Berapa nominalnya?' }
    next.sale_price = price
    return {
      complete: true,
      creation: next,
      actionArgs: {
        name: next.name,
        ...(next.category ? { category: next.category } : {}),
        unit: next.unit,
        stock_quantity: next.stock_quantity,
        unit_cost: next.unit_cost,
        sale_price: next.sale_price
      },
      attachment: next.image
    }
  }

  return { creation: next, prompt: productCreationPrompt(next) }
}
