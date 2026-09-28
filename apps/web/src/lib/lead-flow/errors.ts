export class LeadFlowConfigError extends Error {
  readonly code = "LEAD_FLOW_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "LeadFlowConfigError";
  }
}

export class LeadFlowApiError extends Error {
  readonly code = "LEAD_FLOW_API";
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LeadFlowApiError";
    this.status = status;
  }
}
