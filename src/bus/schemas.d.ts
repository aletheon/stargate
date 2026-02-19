import type { Static } from '@sinclair/typebox';
export declare const Role: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"console">, import("@sinclair/typebox").TLiteral<"bridge">, import("@sinclair/typebox").TLiteral<"drone">]>;
export type Role = Static<typeof Role>;
export declare const ConnectionHandshake: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"connect">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    role: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"console">, import("@sinclair/typebox").TLiteral<"bridge">, import("@sinclair/typebox").TLiteral<"drone">]>;
    deviceId: import("@sinclair/typebox").TString;
    protocolVersion: import("@sinclair/typebox").TString;
}>;
export declare const HelloOk: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"hello-ok">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    health: import("@sinclair/typebox").TString;
    policyVersion: import("@sinclair/typebox").TString;
}>;
export declare const PairingRequired: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"pairing-required">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    pairingCode: import("@sinclair/typebox").TString;
}>;
export declare const PolicyUpdate: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"policy.update">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    idempotencyKey: import("@sinclair/typebox").TString;
    policyGraph: import("@sinclair/typebox").TAny;
}>;
export declare const IntentPropose: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"intent.propose">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    action: import("@sinclair/typebox").TString;
}>;
export declare const IntentDecision: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"intent.decision">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    decision: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"CLEARANCE">, import("@sinclair/typebox").TLiteral<"VETO">, import("@sinclair/typebox").TLiteral<"TRUNCATION">]>;
}>;
export declare const GovernanceWarning: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"governance.warning">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    message: import("@sinclair/typebox").TString;
}>;
export declare const PicAppend: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"pic.append">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    record: import("@sinclair/typebox").TAny;
}>;
export declare const HealthRequest: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"health">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare const PfsdMessage: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"connect">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    role: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"console">, import("@sinclair/typebox").TLiteral<"bridge">, import("@sinclair/typebox").TLiteral<"drone">]>;
    deviceId: import("@sinclair/typebox").TString;
    protocolVersion: import("@sinclair/typebox").TString;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"hello-ok">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    health: import("@sinclair/typebox").TString;
    policyVersion: import("@sinclair/typebox").TString;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"pairing-required">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    pairingCode: import("@sinclair/typebox").TString;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"policy.update">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    idempotencyKey: import("@sinclair/typebox").TString;
    policyGraph: import("@sinclair/typebox").TAny;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"intent.propose">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    action: import("@sinclair/typebox").TString;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"intent.decision">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    decision: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"CLEARANCE">, import("@sinclair/typebox").TLiteral<"VETO">, import("@sinclair/typebox").TLiteral<"TRUNCATION">]>;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"governance.warning">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    message: import("@sinclair/typebox").TString;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"pic.append">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    record: import("@sinclair/typebox").TAny;
}>, import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<"health">;
    id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>]>;
export type PfsdMessage = Static<typeof PfsdMessage>;
//# sourceMappingURL=schemas.d.ts.map