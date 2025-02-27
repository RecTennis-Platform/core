export enum CustomResponseStatusCodes {
  // 1xxx - Tournament
  TOURNAMENT_NOT_FOUND = 1001,
  TOURNAMENT_NOT_PUBLISHED = 1002,
  TOURNAMENT_CREATED_FAILED = 1003,
  TOURNAMENT_PUBLISHED_UNAUTHORIZED = 1004,
  TOURNAMENT_PUBLISHED_FAILED = 1005,
  TOURNAMENT_UNAUTHORIZED_ACCESS = 1006,
  TOURNAMENT_FINALIZED_APPLICANT_LIST_FAILED = 1007,
  TOURNAMENT_APPLICANT_LIST_ALREADY_FINALIZED = 1008,
  TOURNAMENT_APPLICANT_LIST_NOT_FINALIZED = 1009,
  TOURNAMENT_INVALID_PHASE = 1010,
  TOURNAMENT_INVALID_NUMBER_APPLICANT = 1011,
  TOURNAMENT_INFO_UPDATE_FAIL = 1012,
  TOURNAMENT_UNPUBLISHED_UNAUTHORIZED = 1013,
  TOURNAMENT_UNPUBLISHED_FAILED = 1014,

  FIXTURE_NOT_FOUND = 1015,
  TOURNAMENT_INVALID_FORMAT = 1016,
  TOURNAMENT_END_FAILED = 1017,

  // 2xxx - Purchased package
  PURCHASED_PACKAGE_NOT_FOUND = 2001,
  PURCHASED_PACKAGE_IS_EXPIRED = 2002,

  // 3xxx - Package
  PACKAGE_DOES_NOT_HAVE_CREATE_TOURNAMENT_SERVICE = 3001,
  PACKAGE_EXCEEDED_CREATE_TOURNAMENT_LIMIT = 3002,
  PACKAGE_EXCEEDED_MAX_PARTICIPANTS_LIMIT = 3003,

  // 4xxx - Tournament registration
  TOURNAMENT_REGISTRATION_NOT_FOUND = 4001,
  TOURNAMENT_REGISTRATION_APPROVE_FAILED = 4002,
  TOURNAMENT_REGISTRATION_REJECT_FAILED = 4003,
  TOURNAMENT_SUBMITTED_REGISTRATION_INVALID = 4004,
  TOURNAMENT_REGISTRATION_ALREADY_APPLIED = 4005,
  TOURNAMENT_REGISTRATION0_INVALID_GENDER = 4006,
  TOURNAMENT_REGISTRATION_CANNOT_CANCEL = 4007,
  TOURNAMENT_REGISTRATION_CANCEL_FAILED = 4008,
  TOURNAMENT_REGISTRATION_ALREADY_CANCEL = 4009,
  TOURNAMENT_REGISTRATION_CANNOT_APPLY_OWN_TOURNAMENT = 4010,

  // 5xxx - Tournament invitation
  TOURNAMENT_INVITATION_NOT_FOUND = 5001,
  TOURNAMENT_INVITATION_ACCEPT_FAILED = 5002,
  TOURNAMENT_INVITATION_REJECT_FAILED = 5003,
  TOURNAMENT_INVITATION_ALREADY_ACCEPTED = 5004,

  // 6xxx - User
  USER_NOT_FOUND = 6001,

  //7xxx - Fund
  TOURNAMENT_FUND_NOT_FOUND = 7001,
}
