// DO NOT EDIT THIS FILE. IT IS GENERATED AUTOMATICALLY.

/* eslint-disable */

import { z } from 'zod';

import { Iso8601Date } from '@votingworks/types';

/**
 * Type for xsd:datetime values.
 */
export type DateTime = z.TypeOf<typeof Iso8601Date>;

/**
 * Schema for {@link DateTime}.
 */
export const DateTimeSchema = Iso8601Date;

/**
 * Type for xsd:date values.
 */
export type Date = z.TypeOf<typeof Iso8601Date>;

/**
 * Schema {@link Date}.
 */
export const DateSchema = Iso8601Date;

/**
 * A URI/URL.
 */
export type Uri = string;

/**
 * Schema for {@link Uri}.
 */
export const UriSchema = z.string();

/**
 * Byte data stored in a string.
 */
export type Byte = string;

/**
 * Schema for {@link Byte}.
 */
export const ByteSchema = z.string();

/**
 * An integer number, i.e. a whole number without fractional part.
 */
export type integer = number;

/**
 * Schema for {@link integer}.
 */
export const integerSchema = z.number().int();

/**
 * Used in Device::Type to describe the type or usage of the device generating the event.
 */
export enum DeviceType {
  /**
   * Electronic adjudication function for reviewing absentee/mail-in ballots anomalies (blanks/overvotes/write-ins/unreadable ballots).
   */
  Adjudication = 'adjudication',

  /**
   * Devices for enabling a vote capture device (VCD) to display a ballot, possibly directly connected to the VCD or through a smart card interface.
   */
  BallotActivation = 'ballot-activation',

  /**
   * Marked ballot printing devices (voter facing).
   */
  BallotPrinting = 'ballot-printing',

  /**
   * On-demand blank ballot printers.
   */
  BlankBallotPrinting = 'blank-ballot-printing',

  /**
   * Ballot marking devices (voter facing).
   */
  Bmd = 'bmd',

  /**
   * Electronic voter stations, standalone or daisy chained to a DRE-controller (voter facing).
   */
  Dre = 'dre',

  /**
   * Network controller for electronic voting (poll worker facing).
   */
  DreController = 'dre-controller',

  /**
   * DREs, or other devices that store cast vote records electronically (voter facing).
   */
  ElectronicCast = 'electronic-cast',

  /**
   * DREs, or devices that store cast vote records electronically and also print a paper record (voter facing).
   */
  ElectronicCastPaper = 'electronic-cast-paper',

  /**
   * Electronic poll book devices.
   */
  ElectronicPollBook = 'electronic-poll-book',

  /**
   * Election management systems, including for pre- and post-election administration and reporting functions.
   */
  Ems = 'ems',

  /**
   * Used when no other value in this enumeration applies.
   */
  Other = 'other',

  /**
   * Scanning devices for batches of ballots, auto-feeding, e.g., Central Count (poll worker facing).
   */
  ScanBatch = 'scan-batch',

  /**
   * Scanning devices for single-sheets, e.g., Precinct Count (voter facing), but could be used for Central Count by an election official.
   */
  ScanSingle = 'scan-single',

  /**
   * Remote transmission hosts, e.g., for the receiving of unofficial results at a central location from a remote location (receiving station).
   */
  TransmissionReceiving = 'transmission-receiving',

  /**
   * Remote transmission clients, e.g., for sending of unofficial results from a remote location to a central location (sending station).
   */
  TransmissionSending = 'transmission-sending',
}

/**
 * Schema for {@link DeviceType}.
 */
export const DeviceTypeSchema = z.nativeEnum(DeviceType);

/**
 * Used in Event::Disposition for types of event dispositions.
 */
export enum EventDispositionType {
  /**
   * For a failure disposition.
   */
  Failure = 'failure',

  /**
   * Used when the disposition is not applicable or there is no disposition.
   */
  Na = 'na',

  /**
   * Used when no other value in this enumeration applies.
   */
  Other = 'other',

  /**
   * For a successful disposition.
   */
  Success = 'success',
}

/**
 * Schema for {@link EventDispositionType}.
 */
export const EventDispositionTypeSchema = z.nativeEnum(EventDispositionType);

/**
 * Used in Hash::Type to indicate the type of hash being used for an image file.
 */
export enum HashType {
  /**
   * To indicate that the MD6 message digest algorithm is being used.
   */
  Md6 = 'md6',

  /**
   * Used when no other value in this enumeration applies.
   */
  Other = 'other',

  /**
   * To indicate that the SHA 256-bit signature is being used.
   */
  Sha256 = 'sha-256',

  /**
   * To indicate that the SHA 512-bit (32-byte) signature is being used.
   */
  Sha512 = 'sha-512',
}

/**
 * Schema for {@link HashType}.
 */
export const HashTypeSchema = z.nativeEnum(HashType);

/**
 * Device contains information about the device generating election event logs. Id is the only required attribute, all other attributes are optional.  If the device type is not found in the DeviceType enumeration, Type is 'other' and OtherType contains the appropriate type.
 */
export interface Device {
  readonly '@type': 'EventLogging.Device';

  /**
   * Used to associate any details with the event log.
   */
  readonly Details?: string;

  /**
   * Used to describe a logged event.
   */
  readonly Event?: readonly Event[];

  /**
   * The type of the hash, from the HashType enumeration.
   */
  readonly HashType?: HashType;

  /**
   * A serial number or otherwise identifier associated with the device.
   */
  readonly Id: string;

  /**
   * Manufacturer of the device.
   */
  readonly Manufacturer?: string;

  /**
   * Model of the device.
   */
  readonly Model?: string;

  /**
   * If HashType is 'other', the type of the hash.
   */
  readonly OtherHashType?: string;

  /**
   * Used when Type is 'other'.
   */
  readonly OtherType?: string;

  /**
   * Enumerated usage of the device, e.g., ems, scan-single, etc.
   */
  readonly Type?: DeviceType;

  /**
   * Version identification of the device.
   */
  readonly Version?: string;
}

/**
 * Schema for {@link Device}.
 */
export const DeviceSchema: z.ZodSchema<Device> = z.object({
  '@type': z.literal('EventLogging.Device'),
  Details: z.optional(z.string()),
  Event: z.optional(z.array(z.lazy(/* istanbul ignore next */ () => EventSchema))),
  HashType: z.optional(z.lazy(/* istanbul ignore next */ () => HashTypeSchema)),
  Id: z.string(),
  Manufacturer: z.optional(z.string()),
  Model: z.optional(z.string()),
  OtherHashType: z.optional(z.string()),
  OtherType: z.optional(z.string()),
  Type: z.optional(z.lazy(/* istanbul ignore next */ () => DeviceTypeSchema)),
  Version: z.optional(z.string()),
});

/**
 * ElectionEventLog is the root class.  It includes Device for identifying the device(s) generating the election events, the date and time when the election event log was created, and an identification of the election. Details is used as needed for additional description/details. HashType is used to specify a cryptographic hash associated with the events, that is, an event log entry, using values from the HashType enumeration.  If the type of hash is not found in the HashType enumeration, HashType is 'other' and OtherHashType contains the type of hash.
 */
export interface ElectionEventLog {
  readonly '@type': 'EventLogging.ElectionEventLog';

  /**
   * Used to associate any details with the event log.
   */
  readonly Details?: string;

  /**
   * Used to describe the device(s) generating the election events.
   */
  readonly Device?: readonly Device[];

  /**
   * Identifies the election associated with the log.
   */
  readonly ElectionId?: string;

  /**
   * Identifies the date and time the log was generated.
   */
  readonly GeneratedTime: DateTime;
}

/**
 * Schema for {@link ElectionEventLog}.
 */
export const ElectionEventLogSchema: z.ZodSchema<ElectionEventLog> = z.object({
  '@type': z.literal('EventLogging.ElectionEventLog'),
  Details: z.optional(z.string()),
  Device: z.optional(z.array(z.lazy(/* istanbul ignore next */ () => DeviceSchema))),
  ElectionId: z.optional(z.string()),
  GeneratedTime: DateTimeSchema,
});

/**
 * ElectionEventLogDocumention is the root class.  It includes EventIdDescription and EventTypeDescription, as well as other information for identifying the specific device associated with the election event documentation.
 */
export interface ElectionEventLogDocumentation {
  readonly '@type': 'EventLogging.ElectionEventLogDocumentation';

  /**
   * A serial number or otherwise identifier associated with the device.
   */
  readonly DeviceId?: string;

  /**
   * Manufacturer of the device.
   */
  readonly DeviceManufacturer: string;

  /**
   * Model of the device.
   */
  readonly DeviceModel: string;

  /**
   * Version identification of the device.
   */
  readonly DeviceVersion?: string;

  /**
   * For associating a description with an event ID.
   */
  readonly EventIdDescription: readonly EventIdDescription[];

  /**
   * For associating a description with an event type.
   */
  readonly EventTypeDescription: readonly EventTypeDescription[];

  /**
   * Identifies the date the documentation report was generated.
   */
  readonly GeneratedDate: Date;
}

/**
 * Schema for {@link ElectionEventLogDocumentation}.
 */
export const ElectionEventLogDocumentationSchema: z.ZodSchema<ElectionEventLogDocumentation> = z.object({
  '@type': z.literal('EventLogging.ElectionEventLogDocumentation'),
  DeviceId: z.optional(z.string()),
  DeviceManufacturer: z.string(),
  DeviceModel: z.string(),
  DeviceVersion: z.optional(z.string()),
  EventIdDescription: z.array(z.lazy(/* istanbul ignore next */ () => EventIdDescriptionSchema)).min(1),
  EventTypeDescription: z.array(z.lazy(/* istanbul ignore next */ () => EventTypeDescriptionSchema)).min(1),
  GeneratedDate: DateSchema,
});

/**
 * Event holds information about a specific event. Severity is an optional attribute for describing a severity indication for the event.  If the event disposition is not found in the EventDispositionType enumeration, Disposition is 'other' and OtherDisposition contains the other disposition.
 */
export interface Event {
  readonly '@type': 'EventLogging.Event';

  /**
   * Used for a brief description of the event.
   */
  readonly Description?: string;

  /**
   * Used for additional information about the event, e.g., vendor reserved information.
   */
  readonly Details?: string;

  /**
   * The disposition, e.g., success or failure, of the event.
   */
  readonly Disposition: EventDispositionType;

  /**
   * Contains a cryptographic hash of the event, encoded as a string.
   */
  readonly Hash?: string;

  /**
   * An identifier associated with the event.
   */
  readonly Id: string;

  /**
   * Used when Disposition is 'other'.
   */
  readonly OtherDisposition?: string;

  /**
   * A sequence number/string to uniquely identify the event in the log file.
   */
  readonly Sequence: string;

  /**
   * Used for an indication of the severity of the event, as determined by the device vendor.
   */
  readonly Severity?: string;

  /**
   * Identifies the date and time the event was generated.
   */
  readonly TimeStamp: DateTime;

  /**
   * Used for the type of event, as determined by the device vendor.
   */
  readonly Type: string;

  /**
   * An identifier associated with a user, as relevant.
   */
  readonly UserId?: string;
}

/**
 * Schema for {@link Event}.
 */
export const EventSchema: z.ZodSchema<Event> = z.object({
  '@type': z.literal('EventLogging.Event'),
  Description: z.optional(z.string()),
  Details: z.optional(z.string()),
  Disposition: z.lazy(/* istanbul ignore next */ () => EventDispositionTypeSchema),
  Hash: z.optional(z.string()),
  Id: z.string(),
  OtherDisposition: z.optional(z.string()),
  Sequence: z.string(),
  Severity: z.optional(z.string()),
  TimeStamp: DateTimeSchema,
  Type: z.string(),
  UserId: z.optional(z.string()),
});

/**
 * For associating a brief description with an election event ID, used in ElectionEventLogDocumentation::EventIdDescription.
 */
export interface EventIdDescription {
  readonly '@type': 'EventLogging.EventIdDescription';

  /**
   * Used for a brief description of the event.
   */
  readonly Description: string;

  /**
   * An identifier associated with the event.
   */
  readonly Id: string;
}

/**
 * Schema for {@link EventIdDescription}.
 */
export const EventIdDescriptionSchema: z.ZodSchema<EventIdDescription> = z.object({
  '@type': z.literal('EventLogging.EventIdDescription'),
  Description: z.string(),
  Id: z.string(),
});

/**
 * For associating a description with an election event log type, used in ElectionEventLogDocumentation::EventTypeDescription.
 */
export interface EventTypeDescription {
  readonly '@type': 'EventLogging.EventTypeDescription';

  /**
   * Used for a description of the event type.
   */
  readonly Description: string;

  /**
   * An identifier associated with the event type.
   */
  readonly Type: string;
}

/**
 * Schema for {@link EventTypeDescription}.
 */
export const EventTypeDescriptionSchema: z.ZodSchema<EventTypeDescription> = z.object({
  '@type': z.literal('EventLogging.EventTypeDescription'),
  Description: z.string(),
  Type: z.string(),
});
