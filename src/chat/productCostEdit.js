import { isSafeRupiahAmount } from '../money.js'
import { saleMarkupPrice, saleUnits, stockInPcs, unitFactor } from '../productUnits.js'

export function createProductCostUpdate(product, unitCost, costUnit) {
  const enteredCost = Number(unitCost)
  if (!isSafeRupiahAmount(enteredCost, true)) {
    throw new Error('HPP harus berupa nominal Rupiah utuh nol atau lebih.')
  }

  const units = saleUnits(product.unit || 'pcs')
  const normalizedUnit = String(costUnit || (units.includes('pcs') ? 'pcs' : product.unit || 'pcs'))
    .trim()
    .toLocaleLowerCase('id-ID')
  const selectedUnit = units.find((unit) => unit.toLocaleLowerCase('id-ID') === normalizedUnit)
  if (!selectedUnit) {
    throw new Error('Satuan HPP ' + normalizedUnit + ' tidak tersedia untuk ' + product.name + '.')
  }

  const costPerPiece = enteredCost / unitFactor(selectedUnit)
  const inventoryValue = costPerPiece * stockInPcs(product)
  if (!Number.isSafeInteger(Math.round(inventoryValue))) {
    throw new Error('Nilai modal persediaan setelah perubahan melebihi batas penyimpanan.')
  }

  const update = {
    cost: costPerPiece,
    stock_cost_value: Math.round(inventoryValue)
  }
  const salePrices = {}

  for (const unit of ['pcs', 'lusin']) {
    const markupKey = 'sale_markup_' + unit + '_pct'
    if (product[markupKey] == null) continue
    const priceKey = 'price_' + unit
    const price = saleMarkupPrice(costPerPiece, unit, product[markupKey])
    if (isSafeRupiahAmount(price)) {
      update[priceKey] = price
      salePrices[unit] = price
      if (String(product.unit || 'pcs').toLocaleLowerCase('id-ID') === unit) update.price = price
    }
  }

  return { update, enteredCost, costUnit: selectedUnit, costPerPiece, salePrices }
}
