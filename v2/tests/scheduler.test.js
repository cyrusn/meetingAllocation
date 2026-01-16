const Scheduler = require('./core/scheduler')
const { checkParticipantsAvailability } = require('./utils/availability')
const { mergePrincipalsToMeetings, checkPrefilledMeetings } = require('./utils/dataProcessor')

// Mock Data
const mockSlots = [
  '2023-10-23T15:30:00.000+08:00',
  '2023-10-23T16:30:00.000+08:00',
  '2023-10-24T15:30:00.000+08:00'
]

const mockLocations = ['G01', 'G02', 'G10']

const mockOrders = ['Meeting A', 'Meeting B']

const mockPrincipalsMeetings = [
  { name: 'Principal1', meetings: ['Meeting A'] }
]

const mockMeetings = [
  {
    name: 'Meeting A',
    cname: 'Mtg A',
    pics: ['TeacherA'],
    members: ['TeacherB'],
    duration: 1,
    location: null,
    remark: ''
  },
  {
    name: 'Meeting B',
    cname: 'Mtg B',
    pics: ['TeacherC'],
    members: ['TeacherD'],
    duration: 1,
    location: null,
    remark: ''
  }
]

const mockPrefilled = [
  {
    name: 'Meeting A',
    slot: '2023-10-23T15:30:00.000+08:00',
    location: 'G01'
  }
]

const mockUnavailables = {
  'TeacherB': [
    {
      start: '2023-10-24T15:30:00.000+08:00',
      end: '2023-10-24T16:30:00.000+08:00',
      ignoredMeeting: ''
    }
  ]
}

console.log('--- Starting Test ---')

try {
  // 1. Test Data Processing
  console.log('Testing mergePrincipalsToMeetings...')
  const mergedMeetings = mergePrincipalsToMeetings(mockPrincipalsMeetings, mockMeetings, mockOrders)
  
  const meetingWithPrincipal = mergedMeetings.find(m => m.name === 'Meeting A')
  if (meetingWithPrincipal && meetingWithPrincipal.principals.includes('Principal1')) {
    console.log('✅ Principals merged correctly')
  } else {
    console.error('❌ Principals merge failed')
    console.log('Merged Meetings:', JSON.stringify(mergedMeetings, null, 2))
  }

  // 2. Test Availability
  console.log('Testing checkParticipantsAvailability...')
  const availabilityCheck = checkParticipantsAvailability({
    unavailables: mockUnavailables,
    slot: '2023-10-24T15:30:00.000+08:00',
    participants: ['TeacherB'],
    duration: 1,
    meetingName: 'Meeting C'
  })
  
  if (availabilityCheck.isAllAvailable === false) {
    console.log('✅ Availability check correctly identified conflict')
  } else {
    console.error('❌ Availability check failed (expected conflict)')
  }

  // 3. Test Scheduler
  console.log('Testing Scheduler...')
  const scheduler = new Scheduler({ G10_CAPACITY: 6 })
  
  const results = scheduler.run({
    meetings: mergedMeetings,
    prefilledMeetings: mockPrefilled,
    unavailables: mockUnavailables,
    slots: mockSlots,
    locations: mockLocations
  })

  console.log(`Scheduled ${results.length} meetings`)

  const meetingA = results.find(m => m.name === 'Meeting A')
  const meetingB = results.find(m => m.name === 'Meeting B')

  if (meetingA && meetingA.slot === mockPrefilled[0].slot && meetingA.location === 'G01') {
    console.log('✅ Prefilled meeting assigned correctly')
  } else {
    console.error('❌ Prefilled meeting assignment failed')
  }

  if (meetingB && meetingB.slot) {
    console.log(`✅ Meeting B assigned to ${meetingB.slot}`)
  } else {
    console.error('❌ Meeting B was not assigned')
  }

  console.log('--- Test Complete ---')

} catch (error) {
  console.error('Test Failed with Error:', error)
}
