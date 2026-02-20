import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const Role = Type.Union([
    Type.Literal('console'),
    Type.Literal('bridge'),
    Type.Literal('drone'),
]);

export type Role = Static<typeof Role>;

export const ConnectionHandshake = Type.Object({
    type: Type.Literal('connect'),
    id: Type.Optional(Type.String()),
    role: Role,
    deviceId: Type.String(),
    protocolVersion: Type.String(),
});

export const HelloOk = Type.Object({
    type: Type.Literal('hello-ok'),
    id: Type.Optional(Type.String()),
    health: Type.String(),
    policyVersion: Type.String(),
});

export const PairingRequired = Type.Object({
    type: Type.Literal('pairing-required'),
    id: Type.Optional(Type.String()),
    pairingCode: Type.String(),
});

export const PolicyUpdate = Type.Object({
    type: Type.Literal('policy.update'),
    id: Type.Optional(Type.String()),
    idempotencyKey: Type.String(),
    constraints: Type.Any(),
});

export const PolicyReloaded = Type.Object({
    type: Type.Literal('policy.reloaded'),
    id: Type.Optional(Type.String()),
});

export const IntentPropose = Type.Object({
    type: Type.Literal('intent.propose'),
    id: Type.Optional(Type.String()),
    action: Type.String(),
});

export const IntentDecision = Type.Object({
    type: Type.Literal('intent.decision'),
    id: Type.Optional(Type.String()),
    decision: Type.Union([
        Type.Literal('CLEARANCE'),
        Type.Literal('VETO'),
        Type.Literal('TRUNCATION'),
    ]),
    value: Type.Optional(Type.Any()),
});

export const Observation = Type.Object({
    type: Type.Literal('observation'),
    id: Type.Optional(Type.String()),
    values: Type.Array(Type.Number()),
});

export const GovernanceWarning = Type.Object({
    type: Type.Literal('governance.warning'),
    id: Type.Optional(Type.String()),
    message: Type.String(),
});

export const PicAppend = Type.Object({
    type: Type.Literal('pic.append'),
    id: Type.Optional(Type.String()),
    record: Type.Any(),
});

export const HealthRequest = Type.Object({
    type: Type.Literal('health'),
    id: Type.Optional(Type.String()),
});

export const BusStatus = Type.Object({
    type: Type.Literal('bus.status'),
    id: Type.Optional(Type.String()),
});

export const BusStatusOk = Type.Object({
    type: Type.Literal('bus.status-ok'),
    id: Type.Optional(Type.String()),
    sessions: Type.Array(Type.Object({
        deviceId: Type.Optional(Type.String()),
        role: Type.Optional(Type.String()),
        paired: Type.Boolean(),
    })),
});

export const PfsdMessage = Type.Union([
    ConnectionHandshake,
    HelloOk,
    PairingRequired,
    PolicyUpdate,
    PolicyReloaded,
    IntentPropose,
    IntentDecision,
    GovernanceWarning,
    PicAppend,
    HealthRequest,
    BusStatus,
    BusStatusOk,
    Observation,
]);

export type PfsdMessage = Static<typeof PfsdMessage>;
