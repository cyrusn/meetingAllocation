const _ = require('lodash')

const getOrder = (item, orders) => orders.indexOf(item.name)
const getSize = (item) => item.participants.length
const getBusyness = (item) => item.busyness
const getValidSlotCount = (item) => item.validSlotCount
const getWeightedScore = (item) => item.weightedScore

const createStrategies = (orders) => {
  const _getOrder = (i) => getOrder(i, orders)

  return [
    {
      name: 'Most Constrained First (Fewest Slots)',
      sort: (items) => _.orderBy(items, [getValidSlotCount, getSize], ['asc', 'desc'])
    },
    {
      name: 'Weighted (Size * Busyness)',
      sort: (items) => _.orderBy(items, [getWeightedScore], ['desc'])
    },
    {
      name: 'Size -> Busyness -> Order',
      sort: (items) => _.orderBy(items, [getSize, getBusyness, _getOrder], ['desc', 'desc', 'desc'])
    },
    {
      name: 'Size -> Order -> Busyness',
      sort: (items) => _.orderBy(items, [getSize, _getOrder, getBusyness], ['desc', 'desc', 'desc'])
    },
    {
      name: 'Busyness -> Size -> Order',
      sort: (items) => _.orderBy(items, [getBusyness, getSize, _getOrder], ['desc', 'desc', 'desc'])
    },
    {
      name: 'Busyness -> Order -> Size',
      sort: (items) => _.orderBy(items, [getBusyness, _getOrder, getSize], ['desc', 'desc', 'desc'])
    },
    {
      name: 'Order -> Size -> Busyness',
      sort: (items) => _.orderBy(items, [_getOrder, getSize, getBusyness], ['desc', 'desc', 'desc'])
    },
    {
      name: 'Order -> Busyness -> Size',
      sort: (items) => _.orderBy(items, [_getOrder, getBusyness, getSize], ['desc', 'desc', 'desc'])
    }
  ]
}

const createRandomStrategy = () => ({
  name: 'Randomized Size Priority',
  sort: (items) => {
    const shuffled = _.shuffle(items)
    return _.orderBy(shuffled, [getSize, getBusyness], ['desc', 'desc'])
  }
})

module.exports = {
  createStrategies,
  createRandomStrategy,
  getSize,
  getBusyness
}
