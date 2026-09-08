import { IGeoPoint } from "./safety";
import { SeverityLevel } from "./wellbeing";

export type GpsEventType =
  | "location"
  | "stop"
  | "ignition_on"
  | "ignition_off"
  | "panic"
  | "geofence";

export type BusAnomalyType =
  | "route_deviation"
  | "unexpected_stop"
  | "excessive_speed"
  | "extended_idle"
  | "panic_button"
  | "geofence_violation";

export type AnomalyStatus =
  | "new"
  | "reviewed"
  | "false_positive"
  | "actioned";

export interface IBusStop {
  stopName: string;
  coordinates: IGeoPoint;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  order: number;
}

export interface IBus {
  _id?: string;
  schoolId: string;
  registrationNumber: string;
  make?: string;
  vehicleModel?: string;
  capacity: number;
  currentDriverId?: string;
  isActive: boolean;
  deviceId?: string;
  routeCode?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDriver {
  _id?: string;
  schoolId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBusRoute {
  _id?: string;
  schoolId: string;
  busId: string;
  routeName: string;
  routeCode: string;
  academicYear: string;
  isActive: boolean;
  stops: IBusStop[];
  estimatedDurationMinutes?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStudentBusAssignment {
  _id?: string;
  schoolId: string;
  studentId: string;
  busRouteId: string;
  stopName: string;
  pickupTime?: string;
  dropTime?: string;
  academicYear: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGpsEvent {
  _id?: string;
  busId: string;
  deviceId: string;
  coordinates: IGeoPoint;
  speed?: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Date;
  eventType: GpsEventType;
}

export interface IBusAnomaly {
  _id?: string;
  busId: string;
  busRouteId?: string;
  anomalyType: BusAnomalyType;
  severity: SeverityLevel;
  description?: string;
  relatedGpsEventIds?: string[];
  detectedAt: Date;
  modelVersion?: string;
  status: AnomalyStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  schoolId: string;
  createdAt?: Date;
}
