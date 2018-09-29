import {
  EnqueueJob,
  HostPromiseRejectionTracker,
  surroundingAgent,
} from '../engine.mjs';
import {
  Assert,
  Call,
  CreateBuiltinFunction,
  Get,
  Invoke,
  IsCallable,
  IsConstructor,
  IsPromise,
  NewPromiseCapability,
  PromiseCapabilityRecord,
  PromiseReactionJob,
  PromiseResolve,
  SetFunctionLength,
  SpeciesConstructor,
} from '../abstract-ops/all.mjs';
import { Value, Type } from '../value.mjs';
import { Q, ThrowCompletion, X } from '../completion.mjs';
import { BootstrapPrototype } from './Bootstrap.mjs';

function PromiseProto_catch([onRejected], { thisValue }) {
  const promise = thisValue;
  return Q(Invoke(promise, new Value('then'), [new Value(undefined), onRejected]));
}

function ThenFinallyFunctions([value]) {
  const F = this;

  const onFinally = F.OnFinally;
  Assert(IsCallable(onFinally).isTrue());
  const result = Q(Call(onFinally, new Value(undefined)));
  const C = F.Constructor;
  Assert(IsConstructor(C).isTrue());
  const promise = Q(PromiseResolve(C, result));
  const valueThunk = CreateBuiltinFunction(() => value, []);
  SetFunctionLength(valueThunk, new Value(0));
  return Q(Invoke(promise, new Value('then'), [valueThunk]));
}

function CatchFinallyFunctions([reason]) {
  const F = this;

  const onFinally = F.OnFinally;
  Assert(IsCallable(onFinally).isTrue());
  const result = Q(Call(onFinally, new Value(undefined)));
  const C = F.Constructor;
  Assert(IsConstructor(C).isTrue());
  const promise = Q(PromiseResolve(C, result));
  const thrower = CreateBuiltinFunction(() => new ThrowCompletion(reason), []);
  SetFunctionLength(thrower, new Value(0));
  return Q(Invoke(promise, new Value('then'), [thrower]));
}

function PromiseProto_finally([onFinally], { thisValue }) {
  const promise = thisValue;
  if (Type(promise) !== 'Object') {
    return surroundingAgent.Throw('TypeError');
  }
  const C = SpeciesConstructor(promise, surroundingAgent.intrinsic('%Promise%'));
  Assert(IsConstructor(C).isTrue());
  let thenFinally;
  let catchFinally;
  if (IsCallable(onFinally).isFalse()) {
    thenFinally = onFinally;
    catchFinally = onFinally;
  } else {
    const stepsThenFinally = ThenFinallyFunctions;
    thenFinally = CreateBuiltinFunction(stepsThenFinally, ['Constructor', 'OnFinally']);
    SetFunctionLength(thenFinally, new Value(1));
    thenFinally.Constructor = C;
    thenFinally.OnFinally = onFinally;
    const stepsCatchFinally = CatchFinallyFunctions;
    catchFinally = CreateBuiltinFunction(stepsCatchFinally, ['Constructor', 'OnFinally']);
    SetFunctionLength(catchFinally, new Value(1));
    catchFinally.Constructor = C;
    catchFinally.OnFinally = onFinally;
  }
  return Q(Invoke(promise, new Value('then'), [thenFinally, catchFinally]));
}

export function PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability) {
  Assert(IsPromise(promise).isTrue());
  if (resultCapability) {
    Assert(resultCapability instanceof PromiseCapabilityRecord);
  } else {
    resultCapability = new Value(undefined);
  }
  if (IsCallable(onFulfilled).isFalse()) {
    onFulfilled = new Value(undefined);
  }
  if (IsCallable(onRejected).isFalse()) {
    onRejected = new Value(undefined);
  }
  const fulfillReaction = {
    Capability: resultCapability,
    Type: 'Fulfill',
    Handler: onFulfilled,
  };
  const rejectReaction = {
    Capability: resultCapability,
    Type: 'Reject',
    Handler: onRejected,
  };
  if (promise.PromiseState === 'pending') {
    promise.PromiseFulfillReactions.push(fulfillReaction);
    promise.PromiseRejectReactions.push(rejectReaction);
  } else if (promise.PromiseState === 'fulfilled') {
    const value = promise.PromiseResult;
    EnqueueJob('PromiseJobs', PromiseReactionJob, [fulfillReaction, value]);
  } else {
    Assert(promise.PromiseState === 'rejected');
    const reason = promise.PromiseResult;
    if (promise.PromiseIsHandled === false) {
      HostPromiseRejectionTracker(promise, 'handler');
    }
    EnqueueJob('PromiseJobs', PromiseReactionJob, [rejectReaction, reason]);
  }
  promise.PromiseIsHandled = true;
  return resultCapability.Promise;
}

function PromiseProto_then([onFulfilled, onRejected], { thisValue }) {
  const promise = thisValue;
  if (IsPromise(promise).isFalse()) {
    return surroundingAgent.Throw('TypeError');
  }
  const C = Q(SpeciesConstructor(promise, surroundingAgent.intrinsic('%Promise%')));
  const resultCapability = Q(NewPromiseCapability(C));
  return PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability);
}

export function CreatePromisePrototype(realmRec) {
  const proto = BootstrapPrototype(realmRec, [
    ['catch', PromiseProto_catch, 1],
    ['finally', PromiseProto_finally, 1],
    ['then', PromiseProto_then, 2],
  ], realmRec.Intrinsics['%ObjectPrototype%']);

  realmRec.Intrinsics['%PromiseProto_then%'] = X(Get(proto, new Value('then')));

  realmRec.Intrinsics['%PromisePrototype%'] = proto;
}
