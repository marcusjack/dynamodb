import { toUint8Array as base64ToUint8Array,
fromUint8Array as base64FromUint8Array} from "https://deno.land/x/base64/mod.ts"
import { Collection } from "./collection.ts";
// import { Document } from "./../types.ts"
import { Document,date, memoizedProperty as utilMemoizedProperty, property as utilProperty} from "./../util.ts"

function property(obj: any, name: string, value:any, enumerable?: boolean, isValue?:boolean): void {
  if (value !== null && value !== undefined) {
 utilProperty.apply(this, arguments);
  }
}

function memoizedProperty(obj:any, name: string, get: () => any, enumerable?:boolean): void {
  if (!obj.constructor.prototype[name]) {
   utilMemoizedProperty.apply(this, arguments);
  }
}

export function Shape(shape: Document, options: Document = {}, memberName: string) {
  property(this, 'shape', shape.shape);
  property(this, 'api', options.api, false);
  property(this, 'type', shape.type);
  property(this, 'enum', shape.enum);
  property(this, 'min', shape.min);
  property(this, 'max', shape.max);
  property(this, 'pattern', shape.pattern);
  property(this, 'location', shape.location || this.location || 'body');
  property(this, 'name', this.name || shape.xmlName || shape.queryName ||
    shape.locationName || memberName);
  property(this, 'isStreaming', shape.streaming || this.isStreaming || false);
  property(this, 'requiresLength', shape.requiresLength, false);
  property(this, 'isComposite', shape.isComposite || false);
  property(this, 'isShape', true, false);
  property(this, 'isQueryName', Boolean(shape.queryName), false);
  property(this, 'isLocationName', Boolean(shape.locationName), false);
  property(this, 'isIdempotent', shape.idempotencyToken === true);
  property(this, 'isJsonValue', shape.jsonvalue === true);
  property(this, 'isSensitive', shape.sensitive === true || shape.prototype && shape.prototype.sensitive === true);
  property(this, 'isEventStream', Boolean(shape.eventstream), false);
  property(this, 'isEvent', Boolean(shape.event), false);
  property(this, 'isEventPayload', Boolean(shape.eventpayload), false);
  property(this, 'isEventHeader', Boolean(shape.eventheader), false);
  property(this, 'isTimestampFormatSet', Boolean(shape.timestampFormat) || shape.prototype && shape.prototype.isTimestampFormatSet === true, false);
  property(this, 'endpointDiscoveryId', Boolean(shape.endpointdiscoveryid), false);
  property(this, 'hostLabel', Boolean(shape.hostLabel), false);

  if (options.documentation) {
    property(this, 'documentation', shape.documentation);
    property(this, 'documentationUrl', shape.documentationUrl);
  }

  if (shape.xmlAttribute) {
    property(this, 'isXmlAttribute', shape.xmlAttribute || false);
  }

  // type conversion and parsing
  property(this, 'defaultValue', null);

  this.toWireFormat = function(value: any): any {
    if (value === null || value === undefined) {return '';}

    return value;
  };

  this.toType = function(value:any):any { return value; };
}

/**
 * @api private
 */
Shape.normalizedTypes = {
  character: 'string',
  double: 'float',
  long: 'integer',
  short: 'integer',
  biginteger: 'integer',
  bigdecimal: 'float',
  blob: 'binary'
};

/**
 * @api private
 */
Shape.types = {
  'structure': StructureShape,
  'list': ListShape,
  'map': MapShape,
  'boolean': BooleanShape,
  'timestamp': TimestampShape,
  'float': FloatShape,
  'integer': IntegerShape,
  'string': StringShape,
  'base64': Base64Shape,
  'binary': BinaryShape
};

Shape.resolve = function resolve(shape: Document, options: Document={}): Document {
  if (shape.shape) {
    const refShape: Document = options.api.shapes[shape.shape];

    if (!refShape) {
      throw new Error('Cannot find shape reference: ' + shape.shape);
    }

    return refShape;
  } else {
    return null;
  }
};

Shape.create = function create(shape: Document, options: Document={}, memberName: string= undefined):any {
  if (shape.isShape) {return shape;}

  const refShape:Document = Shape.resolve(shape, options);

  if (refShape) {
    let filteredKeys: string[] = Object.keys(shape);

    if (!options.documentation) {
      filteredKeys = filteredKeys.filter(function(name:string): boolean {
        return !name.match(/documentation/);
      });
    }

    // create an inline shape with extra members
    const InlineShape: any = function(): void {
      refShape.constructor.call(this, shape, options, memberName);
    };

    InlineShape.prototype = refShape;
    return new InlineShape();
  } else {
    // set type if not set
    if (!shape.type) {
      if (shape.members) {shape.type = 'structure';}
      else if (shape.member) {shape.type = 'list';}
      else if (shape.key){ shape.type = 'map';}
      else {shape.type = 'string';}
    }

    // normalize types
    const origType: string = shape.type;

    if (Shape.normalizedTypes[shape.type]) {
      shape.type = Shape.normalizedTypes[shape.type];
    }

    if (Shape.types[shape.type]) {
      return new Shape.types[shape.type](shape, options, memberName);
    } else {
      throw new Error('Unrecognized shape type: ' + origType);
    }
  }
};

function CompositeShape(shape: Document) {
  Shape.apply(this, arguments);
  property(this, 'isComposite', true);

  if (shape.flattened) {
    property(this, 'flattened', shape.flattened || false);
  }
}

function StructureShape(shape: Document, options: Document={}) {
  const self: any = this;
  let requiredMap: Document = null
  const firstInit: boolean = !this.isShape;

  CompositeShape.apply(this, arguments);

  if (firstInit) {
    property(this, 'defaultValue', function() { return {}; });
    property(this, 'members', {});
    property(this, 'memberNames', []);
    property(this, 'required', []);
    property(this, 'isRequired', function() { return false; });
  }

  if (shape.members) {
    property(this, 'members', new Collection(shape.members, options, function(name: string, member:Document): any {
      return Shape.create(member, options, name);
    }));

    memoizedProperty(this, 'memberNames', function(): string[] {
      return shape.xmlOrder || Object.keys(shape.members);
    });

    if (shape.event) {
      memoizedProperty(this, 'eventPayloadMemberName', function(): string {
        const members: Document = self.members;
        const memberNames:string[] = self.memberNames;

        // iterate over members to find ones that are event payloads
        for (let i:number = 0, iLen = memberNames.length; i < iLen; i++) {
          if (members[memberNames[i]].isEventPayload) {
            return memberNames[i];
          }
        }
      });

      memoizedProperty(this, 'eventHeaderMemberNames', function():string[] {
        const members: Document = self.members;
          const memberNames: string[] = self.memberNames;
        const eventHeaderMemberNames: string[] = [];

        // iterate over members to find ones that are event headers
        for (let i: number = 0, iLen = memberNames.length; i < iLen; i++) {
          if (members[memberNames[i]].isEventHeader) {
            eventHeaderMemberNames.push(memberNames[i]);
          }
        }

        return eventHeaderMemberNames;
      });
    }
  }

  if (shape.required) {
    property(this, 'required', shape.required);

    property(this, 'isRequired', function(name: string): boolean {
      if (!requiredMap) {
        // requiredMap = {};
        // 
        // for (let i:number = 0; i < shape.required.length; i++) {
        //   requiredMap[shape.required[i]] = true;
        // }
        requiredMap = shape.required.reduce((acc: Document, req: string): Document => {
          acc[req] = true
          return acc
        }, {})
      }

      return requiredMap[name];
    }, false, true);
  }

  property(this, 'resultWrapper', shape.resultWrapper || null);

  if (shape.payload) {
    property(this, 'payload', shape.payload);
  }

  if (typeof shape.xmlNamespace === 'string') {
    property(this, 'xmlNamespaceUri', shape.xmlNamespace);
  } else if (typeof shape.xmlNamespace === 'object') {
    property(this, 'xmlNamespacePrefix', shape.xmlNamespace.prefix);
    property(this, 'xmlNamespaceUri', shape.xmlNamespace.uri);
  }
}

function ListShape(shape: Document, options: Document={}) {
  const self:any = this
  const firstInit :boolean= !this.isShape;

  CompositeShape.apply(this, arguments);

  if (firstInit) {
    property(this, 'defaultValue', function(): any[] { return []; });
  }

  if (shape.member) {
    memoizedProperty(this, 'member', function(): any {
      return Shape.create(shape.member, options);
    });
  }

  if (this.flattened) {
    const oldName: string = this.name;

    memoizedProperty(this, 'name', function(): string {
      return self.member.name || oldName;
    });
  }
}

function MapShape(shape: Document, options:Document={}) {
  const firstInit:boolean = !this.isShape;

  CompositeShape.apply(this, arguments);

  if (firstInit) {
    property(this, 'defaultValue', function(): Document { return {}; });
    property(this, 'key', Shape.create({type: 'string'}, options));
    property(this, 'value', Shape.create({type: 'string'}, options));
  }

  if (shape.key) {
    memoizedProperty(this, 'key', function():any {
      return Shape.create(shape.key, options);
    });
  }

  if (shape.value) {
    memoizedProperty(this, 'value', function(): any {
      return Shape.create(shape.value, options);
    });
  }
}

function TimestampShape(shape: Document) {
  const self:any  = this;

  Shape.apply(this, arguments);

  if (shape.timestampFormat) {
    property(this, 'timestampFormat', shape.timestampFormat);
  } else if (self.isTimestampFormatSet && this.timestampFormat) {
    property(this, 'timestampFormat', this.timestampFormat);
  } else if (this.location === 'header') {
    property(this, 'timestampFormat', 'rfc822');
  } else if (this.location === 'querystring') {
    property(this, 'timestampFormat', 'iso8601');
  } else if (this.api) {
    switch (this.api.protocol) {
      case 'json':
      case 'rest-json':
        property(this, 'timestampFormat', 'unixTimestamp');
        break;
      case 'rest-xml':
      case 'query':
      case 'ec2':
        property(this, 'timestampFormat', 'iso8601');
        break;
    }
  }

  this.toType = function(value: any):Date {
    if (value === null || value === undefined) {return null;}

    if (typeof value.toUTCString === 'function') {return value;}

    return typeof value === 'string' || typeof value === 'number' ?
           date.parseTimestamp(value) : null;
  };

  this.toWireFormat = function(value: any): string {
    return date.format(value, self.timestampFormat);
  };
}

function StringShape() {
  Shape.apply(this, arguments);

  const nullLessProtocols: string[] = ['rest-xml', 'query', 'ec2'];

  this.toType = function(value:any): any {
    value = this.api && nullLessProtocols.indexOf(this.api.protocol) > -1 ?
      value || '' : value;

    if (this.isJsonValue) {
      return JSON.parse(value);
    }

    return value && typeof value.toString === 'function' ?
      value.toString() : value;
  };

  this.toWireFormat = function(value: any):any {
    return this.isJsonValue ? JSON.stringify(value) : value;
  };
}

function FloatShape() {
  Shape.apply(this, arguments);

  this.toType = function(value: any): number {
    if (value === null || value === undefined) {return null;}

    return parseFloat(value);
  };

  this.toWireFormat = this.toType;
}

function IntegerShape() {
  Shape.apply(this, arguments);

  this.toType = function(value: any):number {
    if (value === null || value === undefined) {return null;}

    return parseInt(value, 10);
  };

  this.toWireFormat = this.toType;
}

function BinaryShape() {
  Shape.apply(this, arguments);

  this.toType = base64ToUint8Array;

  this.toWireFormat = base64FromUint8Array;
}

function Base64Shape() {
  BinaryShape.apply(this, arguments);
}

function BooleanShape() {
  Shape.apply(this, arguments);

  this.toType = function(value: any): boolean {
    if (typeof value === 'boolean') {return value;}

    if (value === null || value === undefined) {return null;}

    return value === 'true';
  };
}

/**
 * @api private
 */
Shape.shapes = {
  StructureShape: StructureShape,
  ListShape: ListShape,
  MapShape: MapShape,
  StringShape: StringShape,
  BooleanShape: BooleanShape,
  Base64Shape: Base64Shape
};

// /**
//  * @api private
//  */
// module.exports = Shape;