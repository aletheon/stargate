import { Type } from '@sinclair/typebox';
export const Role = Type.Union([
    Type.Literal('console'),
    Type.Literal('bridge'),
    Type.Literal('drone'),
]);
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
    policyGraph: Type.Any(), // Placeholder for now
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
export const PfsdMessage = Type.Union([
    ConnectionHandshake,
    HelloOk,
    PairingRequired,
    PolicyUpdate,
    IntentPropose,
    IntentDecision,
    GovernanceWarning,
    PicAppend,
    HealthRequest,
]);
//# sourceMappingURL=schemas.js.map