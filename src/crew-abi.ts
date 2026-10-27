// ABI slices for CrewFactory and Crew — sourced from compiled artifacts

export const CREW_FACTORY_ABI = [
  {
    type: 'constructor',
    inputs: [{ name: '_usdc', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createCrew',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'recipients', type: 'address[]' },
      { name: 'recipientBps', type: 'uint16[]' },
      { name: 'payrollBps', type: 'uint16' },
    ],
    outputs: [{ name: 'crew', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'crewsOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'crewCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'crewAt',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'implementation',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CrewCreated',
    inputs: [
      { name: 'crew', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
    ],
  },
] as const

export const CREW_ABI = [
  // initialize
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: '_usdc', type: 'address' },
      { name: '_owner', type: 'address' },
      { name: '_name', type: 'string' },
      { name: '_recipients', type: 'address[]' },
      { name: '_recipientBps', type: 'uint16[]' },
      { name: '_payrollBps', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // views
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'pendingOwner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'payrollPool', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'payrollBps', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'getSplit',
    inputs: [],
    outputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'bps', type: 'uint16[]' },
      { name: 'payrollBps', type: 'uint16' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMembers',
    inputs: [],
    outputs: [
      {
        name: 'members',
        type: 'tuple[]',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'label', type: 'string' },
          { name: 'weeklyRate', type: 'uint256' },
          { name: 'owed', type: 'uint256' },
          { name: 'accruedNow', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  { type: 'function', name: 'totalAccruedNow', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'weeklyBurn', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'runwaySeconds', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'undistributed', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  // writes
  {
    type: 'function',
    name: 'distribute',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pay',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSplit',
    inputs: [
      { name: '_recipients', type: 'address[]' },
      { name: '_bps', type: 'uint16[]' },
      { name: '_payrollBps', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSplitEmergency',
    inputs: [
      { name: '_recipients', type: 'address[]' },
      { name: '_bps', type: 'uint16[]' },
      { name: '_payrollBps', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fundPayroll',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addMember',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'label', type: 'string' },
      { name: 'weeklyRate', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRate',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'newWeeklyRate', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeMember',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawPayroll',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // events
  {
    type: 'event',
    name: 'Revenue',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Distributed',
    inputs: [
      { name: 'newRevenue', type: 'uint256', indexed: false },
      { name: 'toPayroll', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Paid',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'paid', type: 'uint256', indexed: false },
      { name: 'stillOwed', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberAdded',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'label', type: 'string', indexed: false },
      { name: 'weeklyRate', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberRemoved',
    inputs: [{ name: 'wallet', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'RateChanged',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'newWeeklyRate', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SplitUpdated',
    inputs: [
      { name: 'recipients', type: 'address[]', indexed: false },
      { name: 'bps', type: 'uint16[]', indexed: false },
      { name: 'payrollBps', type: 'uint16', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayrollFunded',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayrollWithdrawn',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const
