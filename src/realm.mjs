import {
  Value,
  Type,
  Descriptor,
} from './value.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  DefinePropertyOrThrow,
  ObjectCreate,
} from './abstract-ops/all.mjs';
import {
  NewGlobalEnvironment,
} from './environment.mjs';
import {
  surroundingAgent,
} from './engine.mjs';
import { Q, X } from './completion.mjs';

import { CreateObjectPrototype } from './intrinsics/ObjectPrototype.mjs';
import { CreateObject } from './intrinsics/Object.mjs';
import { CreateArrayPrototype } from './intrinsics/ArrayPrototype.mjs';
import { CreateArray } from './intrinsics/Array.mjs';
import { CreateBooleanPrototype } from './intrinsics/BooleanPrototype.mjs';
import { CreateBoolean } from './intrinsics/Boolean.mjs';
import { CreateNumberPrototype } from './intrinsics/NumberPrototype.mjs';
import { CreateNumber } from './intrinsics/Number.mjs';
import { CreateFunctionPrototype } from './intrinsics/FunctionPrototype.mjs';
import { CreateFunction } from './intrinsics/Function.mjs';
import { CreateSymbolPrototype } from './intrinsics/SymbolPrototype.mjs';
import { CreateSymbol } from './intrinsics/Symbol.mjs';
import { CreateMath } from './intrinsics/Math.mjs';
import { CreatePromisePrototype } from './intrinsics/PromisePrototype.mjs';
import { CreatePromise } from './intrinsics/Promise.mjs';
import { CreateProxy } from './intrinsics/Proxy.mjs';
import { CreateReflect } from './intrinsics/Reflect.mjs';
import { CreateStringPrototype } from './intrinsics/StringPrototype.mjs';
import { CreateString } from './intrinsics/String.mjs';
import { CreateErrorPrototype } from './intrinsics/ErrorPrototype.mjs';
import { CreateError } from './intrinsics/Error.mjs';
import { CreateNativeError } from './intrinsics/NativeError.mjs';
import { CreateIteratorPrototype } from './intrinsics/IteratorPrototype.mjs';
import { CreateAsyncIteratorPrototype } from './intrinsics/AsyncIteratorPrototype.mjs';
import { CreateArrayIteratorPrototype } from './intrinsics/ArrayIteratorPrototype.mjs';
import { CreateMapIteratorPrototype } from './intrinsics/MapIteratorPrototype.mjs';
import { CreateSetIteratorPrototype } from './intrinsics/SetIteratorPrototype.mjs';
import { CreateMapPrototype } from './intrinsics/MapPrototype.mjs';
import { CreateMap } from './intrinsics/Map.mjs';
import { CreateSetPrototype } from './intrinsics/SetPrototype.mjs';
import { CreateSet } from './intrinsics/Set.mjs';
import { CreateFunctionProperties } from './intrinsics/functionProperties.mjs';
import { CreateGenerator } from './intrinsics/Generator.mjs';
import { CreateGeneratorFunction } from './intrinsics/GeneratorFunction.mjs';

// 8.2 #sec-code-realms
export class Realm {
  constructor() {
    this.Intrinsics = undefined;
    this.GlobalObject = undefined;
    this.GlobalEnv = undefined;
    this.TemplateMap = undefined;
    this.HostDefined = undefined;
  }
}

// 8.2.1 #sec-createrealm
export function CreateRealm() {
  const realmRec = new Realm();
  CreateIntrinsics(realmRec);
  realmRec.GlobalObject = undefined;
  realmRec.GlobalEnv = undefined;
  realmRec.TemplateMap = undefined;
  return realmRec;
}

function AddRestrictedFunctionProperties(F, realm) {
  Assert(realm.Intrinsics['%ThrowTypeError%']);
  const thrower = realm.Intrinsics['%ThrowTypeError%'];
  X(DefinePropertyOrThrow(F, new Value('caller'), Descriptor({
    Get: thrower,
    Set: thrower,
    Enumerable: new Value(false),
    Configurable: new Value(true),
  })));
  X(DefinePropertyOrThrow(F, new Value('arguments'), Descriptor({
    Get: thrower,
    Set: thrower,
    Enumerable: new Value(false),
    Configurable: new Value(true),
  })));
}

// 8.2.2 #sec-createintrinsics
export function CreateIntrinsics(realmRec) {
  const intrinsics = Object.create(null);
  realmRec.Intrinsics = intrinsics;

  const objProto = ObjectCreate(new Value(null));
  intrinsics['%ObjectPrototype%'] = objProto;

  const thrower = CreateBuiltinFunction(
    () => surroundingAgent.Throw('TypeError', 'The caller, callee, and arguments properties may'
      + ' not be accessed on strict mode functions or the arguments objects for calls to them'),
    [], realmRec, new Value(null),
  );
  intrinsics['%ThrowTypeError%'] = thrower;

  const funcProto = CreateBuiltinFunction(() => {}, [], realmRec, objProto);
  intrinsics['%FunctionPrototype%'] = funcProto;

  thrower.SetPrototypeOf(funcProto);

  AddRestrictedFunctionProperties(funcProto, realmRec);

  CreateErrorPrototype(realmRec);
  CreateError(realmRec);
  CreateNativeError(realmRec);

  CreateObjectPrototype(realmRec);
  CreateObject(realmRec);

  CreateFunction(realmRec);
  CreateFunctionPrototype(realmRec);

  CreateIteratorPrototype(realmRec);
  CreateAsyncIteratorPrototype(realmRec);
  CreateArrayIteratorPrototype(realmRec);
  CreateMapIteratorPrototype(realmRec);
  CreateSetIteratorPrototype(realmRec);

  CreateStringPrototype(realmRec);
  CreateString(realmRec);

  CreateArrayPrototype(realmRec);
  CreateArray(realmRec);

  CreateBooleanPrototype(realmRec);
  CreateBoolean(realmRec);

  CreateNumberPrototype(realmRec);
  CreateNumber(realmRec);

  CreateSymbolPrototype(realmRec);
  CreateSymbol(realmRec);

  CreatePromisePrototype(realmRec);
  CreatePromise(realmRec);

  CreateProxy(realmRec);

  CreateReflect(realmRec);

  CreateMath(realmRec);

  CreateSetPrototype(realmRec);
  CreateSet(realmRec);

  CreateMapPrototype(realmRec);
  CreateMap(realmRec);

  CreateFunctionProperties(realmRec);

  CreateGenerator(realmRec);
  CreateGeneratorFunction(realmRec);

  return intrinsics;
}

// 8.2.3 #sec-setrealmglobalobject
export function SetRealmGlobalObject(realmRec, globalObj, thisValue) {
  if (Type(globalObj) === 'Undefined') {
    const intrinsics = realmRec.Intrinsics;
    globalObj = ObjectCreate(intrinsics['%ObjectPrototype%']);
  }

  if (Type(thisValue) === 'Undefined') {
    thisValue = globalObj;
  }

  realmRec.GlobalObject = globalObj;

  const newGlobalEnv = NewGlobalEnvironment(globalObj, thisValue);
  realmRec.GlobalEnv = newGlobalEnv;

  return realmRec;
}

// 8.2.4 #sec-setdefaultglobalbindings
export function SetDefaultGlobalBindings(realmRec) {
  const global = realmRec.GlobalObject;

  // Value Properties of the Global Object
  [
    ['Infinity', new Value(Infinity, realmRec)],
    ['NaN', new Value(NaN, realmRec)],
    ['undefined', new Value(undefined, realmRec)],
  ].forEach(([name, value]) => {
    Q(DefinePropertyOrThrow(global, new Value(name, realmRec), Descriptor({
      Value: value,
      Writable: new Value(false),
      Enumerable: new Value(false),
      Configurable: new Value(false),
    })));
  });

  [
    // Function Properties of the Global Object
    'eval',
    'isFinite',
    'isNaN',
    'parseFloat',
    'parseInt',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',

    // Constructor Properties of the Global Object
    'Array',
    'Boolean',
    'Function',
    'Map',
    'Number',
    'Object',
    'Promise',
    'Proxy',
    'Reflect',
    'Set',
    'String',
    'Symbol',
    'Error',
    'EvalError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
    'URIError',

    // Other Properties of the Global Object
    'Math',
  ].forEach((name) => {
    Q(DefinePropertyOrThrow(global, new Value(name, realmRec), Descriptor({
      Value: realmRec.Intrinsics[`%${name}%`],
      Writable: new Value(true),
      Enumerable: new Value(false),
      Configurable: new Value(true),
    })));
  });

  return global;
}
