export class CustomResponseMessages {
  private static messages = new Map([
    // 1xxx - Tournament
    [1001, 'Tournament not found'],
    [1002, 'Tournament not published'],
    [1003, 'Failed to create tournament'],
    [1004, 'Unauthorized to publish this tournament'],
    [1005, 'Failed to publish tournament'],
    [1006, 'Unauthorized to access this tournament'],
    [1007, 'Failed to finalize the applicant list'],
    [1008, 'Applicant list already finalized'],
    [1009, 'Applicant list not finalized'],

    // 2xxx - Purchased package
    [2001, 'Purchased package not found'],
    [2002, 'Purchased package is expired'],

    // 3xxx - Package
    [3001, 'Package does not have the service to create tournament'],
    [3002, 'Exceeded the limit of allowed tournaments'],
    [3003, 'Exceeded the limit of max participants'],

    // 4xxx - Tournament registration
    [4001, 'Tournament registration not found'],
    [4002, 'Failed to approve tournament registration'],
    [4003, 'Failed to reject tournament registration'],
    [4004, 'Invalid submitted application'],
    [4005, 'Already applied for this tournament'],
    [4006, 'Invalid applicant gender'],
    [4007, 'ot cancel the tournament application after admin approval'],
    [4008, 'Failed to cancel the tournament application'],
  ]);

  private static readonly UNKNOWN_ERROR = 'Unknown error';

  public static getMessage(statusCode: number): string {
    return (
      this.messages.get(statusCode) || CustomResponseMessages.UNKNOWN_ERROR
    );
  }
}
