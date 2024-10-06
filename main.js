// settings

const lastVersion = "v0.0.0";
const version = "v0.0.0";
const baseDataPath = "../data/2024-25_First";
const TITLE = "2024-25 1st Meeting Schedule";

// imports
const fs = require('fs')
const _ = require('lodash')
const { DateTime, Duration, Interval } = require('luxon')
const {
  mergePrincipalsToMeetings,
  checkParticipantsAvailability,
  checkPrefilledMeetings,
  findDiffs
} = require('./helpers.js')

// output files
const outputFilePath = `./out/result.${version}.json`
const lastOutputFilePath = `./out/result.${lastVersion}.json`

// load data
const slots = require(baseDataPath + '/slots.json')
const meetings = require(baseDataPath + '/meetings.json')
const principalsMeetings = require(baseDataPath + '/principals.json')
const prefilledMeetings = require(baseDataPath + '/prefilledMeetings.json')
const unavailableArrays = require(baseDataPath + '/unavailables.json')
const locations = require(baseDataPath + '/locations.json')
const orders = require(baseDataPath + '/orders.json')
const assignedSlots = []
const g10Capacity = 6

// merge principals to meetings
const withPrincipalsMeetings = mergePrincipalsToMeetings(
  principalsMeetings,
  meetings,
  orders
)

checkPrefilledMeetings(prefilledMeetings, withPrincipalsMeetings)

// flatten unavailableArrays. Flatten teachers key to teacher.
// e.g. { teacher: "teacher1", start: "2021-01-01T08:00:00.000Z", end: "2021-01-01T09:00:00.000Z" }
const flattenedUnavailables = unavailableArrays
  .reduce((prev, curr) => {
    if ('teachers' in curr) {
      const { teachers } = curr
      delete curr.teachers

      const flatten = teachers.map((t) =>
        Object.assign({}, { teacher: t }, curr)
      )
      prev = prev.concat(flatten)
      return prev
    }

    prev.push(curr)
    return prev
  }, [])
  .reduce((prev, curr) => {
    if ('slots' in curr) {
      const { slots, teacher } = curr
      delete curr.slots
      const flatten = slots.map((s) => ({
        teacher,
        start: s.start,
        end: s.end
      }))
      prev = prev.concat(flatten)
      return prev
    }
    prev.push(curr)
    return prev
  }, [])

// convert unavailableArrays to unavailables Object with teacher as key
const unavailables = _.groupBy(flattenedUnavailables, 'teacher')

// assign prefilled meetings first
for (const { name, slot } of prefilledMeetings.filter(({ slot }) => slot)) {
  // check if the slot is available
  const found = withPrincipalsMeetings.find((gp) => gp.name == name)

  // check if the meeting is found
  if (!found) {
    throw new Error(`Prefilled meeting is not found: ${name}`)
  }

  const { members, cname, principals, duration, location, participants } = found

  const { isAllAvailable, notAvailabeParticipants } =
    checkParticipantsAvailability({
      unavailables,
      slot,
      participants,
      duration
    })

  if (!isAllAvailable) {
    console.log(name)
    console.log(notAvailabeParticipants)
    console.log(slot)
    throw new Error('Prefilled meeting is not available')
  }

  const assignedSlot = Object.assign({ slot }, found)

  // use default location if specified in meetings.json
  // if not, will assign location later
  if (location) {
    assignedSlot.location = location
  }

  assignedSlots.push(assignedSlot)
}

// assign meetings
// .sort((a, b) => b.members.length - a.members.length)
for (const meeting of withPrincipalsMeetings) {
  const { name, members, cname, principals, duration, participants, location } =
    meeting
  // check if the meeting is already a pre-filled meeting, skip if yes
  if (
    prefilledMeetings
      .filter(({ slot }) => slot)
      .map(({ name }) => name)
      .includes(name)
  ) {
    continue
  }

  // check if the any slot is available
  for (const slot of slots) {
    // check if all participants are available
    let { isAllAvailable } = checkParticipantsAvailability({
      unavailables,
      slot,
      participants,
      duration
    })

    // check in a certain slot, if any participants is already assigned to a meetings
    const notAvailableMeetings = assignedSlots
      .filter((assignedSlot) => {
        const assignedSlotInterval = Interval.after(
          DateTime.fromISO(assignedSlot.slot),
          Duration.fromObject({ hours: assignedSlot.duration })
        )

        const slotInterval = Interval.after(
          DateTime.fromISO(slot),
          Duration.fromObject({ hours: duration })
        )

        return (
          _.intersection(participants, assignedSlot.participants).length > 0 &&
          assignedSlotInterval.overlaps(slotInterval)
        )
      })
      .map(({ name }) => name)

    if (notAvailableMeetings.length > 0) {
      isAllAvailable = false
    }

    // assign the slot if all participants are available
    if (isAllAvailable) {
      const assignedSlot = Object.assign({ slot }, meeting)

      // use default location if specified in meetings.json
      if (location) {
        assignedSlot.location = location
      }

      assignedSlots.push(assignedSlot)

      // update unavailables with if the slot is assigned
      participants.forEach((participant) => {
        const reservedInterval = Interval.after(
          DateTime.fromISO(slot),
          Duration.fromObject({ hours: duration })
        )
        const reservedSlot = {
          teacher: participant,
          start: reservedInterval.start.toISO(),
          end: reservedInterval.end.toISO()
        }
        unavailables[participant]
          ? unavailables[participant].push(reservedSlot)
          : (unavailables[participant] = [reservedSlot])
      })
      break
    }
  }
}

// assign prefilled meetings location if location is specified in prefilledMeetings.json
for (const { name, location } of prefilledMeetings) {
  if (!location) continue

  const assignedSlot = assignedSlots.find((s) => s.name == name)
  if (assignedSlot) {
    assignedSlot.location = location
  }
}

// assign locations for all meetings
for (const { name, location, slot, members, principals } of assignedSlots) {
  if (location) continue

  const assignedLocations = assignedSlots
    .filter((s) => s.slot == slot)
    .map(({ location }) => location)

  for (const location of locations) {
    if (assignedLocations.includes(location)) continue

    // The G10's capacity should not exceed G10 Capacity.
    const participants = _.uniq([...members, ...principals])
    if (participants.length > g10Capacity && location == 'G10') continue

    assignedSlots.find((s) => s.name == name).location = location
    break
  }
}

const data = _.orderBy(assignedSlots, 'slot')
const timestamp = new Date().toISOString()
const updatedMeetings = findDiffs(data, lastOutputFilePath)

fs.writeFileSync(
  outputFilePath,
  JSON.stringify(
    {
      version,
      title: TITLE,
      timestamp,
      updatedMeetings,
      data
    },
    null,
    2
  ),
  'utf8'
)

console.log('Assigned meetings: ', assignedSlots.length)
console.log('Total number of meetings', meetings.length)
const notAssignedMeetings = _.xor(
  assignedSlots.map(({ name }) => name),
  meetings.map(({ name }) => name)
)
withPrincipalsMeetings
  .filter(({ name }) => notAssignedMeetings.includes(name))
  .forEach(({ name, participants, rank }) =>
    console.log(`${name} (${rank})`, '\n', participants)
  )
