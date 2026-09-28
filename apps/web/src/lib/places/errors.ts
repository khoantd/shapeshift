export class PlacesConfigError extends Error {
  readonly code = "PLACES_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "PlacesConfigError";
  }
}

export class PlacesApiError extends Error {
  readonly code = "PLACES_API";
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
  }
}
