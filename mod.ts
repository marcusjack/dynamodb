import { encode } from "https://denopkg.com/chiefbiiko/std-encoding/mod.ts";
import { HeadersConfig, createHeaders,Translator } from "./client/mod.ts";
import { API } from "./api/mod.ts"
import { Doc } from "./util.ts";

/** Base shape of all DynamoDB query schemas. */
const ATTR_VALUE: string = API.operations.PutItem.input.members.Item.value.shape;

/** Convenience export. */
export { Doc } from "./util.ts";

/** Generic representation of a DynamoDB client. */
export interface DynamoDBClient {
  describeEndpoints: (options?: Doc) => Promise<Doc>;
  describeLimits: (options?: Doc) => Promise<Doc>;
  listTables: (options?: Doc) => Promise<Doc>;
  scan: (params?: Doc, options?: Doc) => Promise<Doc | AsyncIterableIterator<Doc>>;
  query: (params?: Doc, options?: Doc) => Promise<Doc | AsyncIterableIterator<Doc>>;
  [key: string]: (params?: Doc, options?: Doc) => Promise<Doc>;
}

/** Client configuration. */
export interface ClientConfig {
  accessKeyId: string; // AKIAIOSFODNN7EXAMPLE
  secretAccessKey: string; // wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  region: string; // us-west-2
  canonicalUri?: string; // fx /path/to/somewhere
  port?: number; // 8000
}

/** Op options. */
export interface OpOptions {
  wrapNumbers?: boolean, // wrap numbers to a special number value type? [false]
  convertEmptyValues?: boolean, // convert empty strings and binaries? [false]
  translateJSON?: boolean, // translate I/O JSON schemas? [true]
  iteratePages?: boolean // if a result is paged, async-iterate it? [true]
}

/** DynamoDB operations. */
export const OPS: Set<string> = new Set<string>([
  "BatchGetItem",
  "BatchWriteItem",
  "CreateBackup",
  "CreateGlobalTable",
  "CreateTable",
  "DeleteBackup",
  "DeleteItem",
  "DeleteTable",
  "DescribeBackup",
  "DescribeContinuousBackups",
  "DescribeEndpoints",
  "DescribeGlobalTable",
  "DescribeGlobalTableSettings",
  "DescribeLimits",
  "DescribeTable",
  "DescribeTimeToLive",
  "GetItem",
  "ListBackups",
  "ListGlobalTables",
  "ListTables",
  "ListTagsOfResource",
  "PutItem",
  "Query",
  "RestoreTableFromBackup",
  "RestoreTableToPointInTime",
  "Scan",
  "TagResource",
  "TransactGetItems",
  "TransactWriteItems",
  "UntagResource",
  "UpdateContinuousBackups",
  "UpdateGlobalTable",
  "UpdateGlobalTableSettings",
  "UpdateItem",
  "UpdateTable",
  "UpdateTimeToLive"
]);

export const NO_PARAMS_OPS: Set<string> = new Set<string>([
  "DescribeEndpoints",
  "DescribeLimits",
  "ListTables"
])

/** Base fetch. */
function baseFetch(conf: Doc, op: string, params: Doc): Promise<Doc> {
  // console.error(">>>>>>>>>>>>> prep query", JSON.stringify(query), "\n")

    const payload: Uint8Array = encode(JSON.stringify(params), "utf8");
    const headers: Headers = createHeaders({
      ...conf,
      op,
      method: conf.method,
      payload
    } as HeadersConfig);

    return fetch(conf.endpoint, {
      method: conf.method,
      headers,
      body: payload
    }).then(
     (response: Response): Doc => {
        // console.error(">>>>>>> op response.status",op,  response.status," response.statusText", response.statusText)
        // console.error(">>>>>>> response.statusText", response.statusText)
        if (!response.ok) {
          // console.error("RESPONSE >>>>>>>>>>>>>>>>>>>>>>>>>>>> ", JSON.stringify(await response.json()))
          throw new Error(`http query request failed: ${response.status} ${response.statusText}`)
        }

        return response.json();
      }
    );
}

/** Base op. */
async function baseOp(
  conf: Doc,
  op: string,
  params: Doc = {},
  { wrapNumbers= false,
  convertEmptyValues = false,
  translateJSON = true,
  iteratePages= true
}: OpOptions = NO_PARAMS_OPS.has(op) ? params || {} : {}
): Promise<Doc> {
  let translator: any
  //     console.error(">>>>>>>>>>> op", op)
  // console.error("\n>>>>>>>>>>>>> user query", JSON.stringify(query))
  let outputShape: any

  if (translateJSON) {
    /*
    options.attrValue =
      self.service.api.operations.putItem.input.members.Item.value.shape;
    */
    translator = new Translator({wrapNumbers, convertEmptyValues, attrValue: ATTR_VALUE})
    // translator = new Translator(options)

        // console.error(">>>>>>>>>>> API.operations", API.operations)
    // console.error(">>>>>>>>>>> API.operations[op].input", API.operations[op].input)
    // const inputShape: any = API.operations[op].input
    outputShape = API.operations[op].output
    // TODO
    // var preserve = {}
    // const preserve: Doc = //{}
    // for each inputShape.members prop if value == empty object then preserve[key] = value
    // const toTranslate: Doc =  Object.entries(inputShape.members).reduce((acc: Doc, [key, value]: [string, string]): Doc => {
    //   console.error(">>>>>>>>> CHECK", key)
    //   if (key === "Key" || key === "Item") {
    //     console.log(">>>>>>>>>>>>> translateE KEY", key)
    //     acc[key] = query[key]
    //   }
    //
    //   return acc
    // }, {})
    // console.error(">>>>>>>>>>>>>> TOTRANSLATE", JSON.stringify(toTranslate))
    // query = { ...query, ...translator.translateInput(toTranslate, inputShape).M }
    params = translator.translateInput(params, API.operations[op].input)
  } else {
    params = { ...params}
  }

// console.error(">>>>>>>>>>>>> prep query", JSON.stringify(query), "\n")
//
//   const payload: Uint8Array = encode(JSON.stringify(query), "utf8");
//   const headers: Headers = createHeaders({
//     ...conf,
//     op,
//     method: conf.method,
//     payload
//   } as HeadersConfig);
//
//   const rawResult: Doc = await fetch(conf.endpoint, {
//     method: conf.method,
//     headers,
//     body: payload
//   }).then(
//     (response: Response): Doc => {
//       console.error(">>>>>>> response.status", response.status," response.statusText", response.statusText)
//       // console.error(">>>>>>> response.statusText", response.statusText)
//       if (!response.ok) {
//         throw new Error(`http query request failed: ${response.status} ${response.statusText}`)
//       }
//
//       return response.json();
//     }
//   );

   let rawResult: Doc = await baseFetch(conf, op, params)
// console.error(">>>>>>>>>>> rawResult.LastEvaluatedKey",rawResult.LastEvaluatedKey)
   if (rawResult.LastEvaluatedKey && iteratePages) {
     // TODO: return an async iterator over the pages -- outsource
     // let sawEOF: boolean = false
     let lastEvaluatedKey: any = rawResult.LastEvaluatedKey
     let first: boolean = true

     return {
       [Symbol.asyncIterator](): AsyncIterableIterator<Doc> {
         return this;
       },
       async next(): Promise<IteratorResult<Doc>> {
         // console.error(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> NEXT")
         // if (sawEof) {
         //   return { value: new Uint8Array(), done: true };
         // }
         //
         // const result = await r.read(b);
         // if (result === EOF) {
         //   sawEof = true;
         //   return { value: new Uint8Array(), done: true };
         // }
         //
         // return {
         //   value: b.subarray(0, result),
         //   done: false
         // };
         if (!lastEvaluatedKey) {
           return {value:{},done:true}
         }

        if (first) {
          first = false

          lastEvaluatedKey = rawResult.LastEvaluatedKey

          if (!translateJSON) {
            return {
              value: rawResult,
              done: false
            }
          } else {
            // const outputShape: any = API.operations[op].output
            // var result = translator.translateOutput(rawResult, outputShape)
            // console.error(">>>>>>>>>>> result", result)

            return {
              value: translator.translateOutput(rawResult, outputShape),
              done: false
            }
          }
        } else {
              params.ExclusiveStartKey = lastEvaluatedKey
        }

         rawResult =  await baseFetch(conf, op, params)

         lastEvaluatedKey = rawResult.LastEvaluatedKey

         if (!translateJSON) {
           return {value :rawResult, done: false}//!lastEvaluatedKey}
         }

         // const outputShape: any = API.operations[op].output
         // var result = translator.translateOutput(rawResult, outputShape)
         // console.error(">>>>>>>>>>> result", result)
           return {value :translator.translateOutput(rawResult, outputShape), done: false}// !lastEvaluatedKey} // result
       }
     };
   }

// console.error(">>>>>>>>> rawResult", JSON.stringify(rawResult))
  if (!translateJSON) {
    return rawResult
  }

// const outputShape: any = API.operations[op].output
// var result = translator.translateOutput(rawResult, outputShape)
// // console.error(">>>>>>>>>>> result", result)
//   return result
return translator.translateOutput(rawResult, outputShape)
}

/** Creates a DynamoDB client. */
export function createClient(conf: ClientConfig): DynamoDBClient {
  if (!conf.accessKeyId || !conf.secretAccessKey || !conf.region) {
    throw new TypeError(
      "client config must include accessKeyId, secretAccessKey and region"
    );
  }

  const method: string = "POST";

  const host: string =
    conf.region === "local"
      ? "localhost"
      : `dynamodb.${conf.region}.amazonaws.com`;

  const endpoint: string = `http${
    conf.region === "local" ? "" : "s"
  }://${host}:${conf.port || 8000}/`;

  const _conf: Doc = { ...conf, host, method, endpoint };

  const ddbc: DynamoDBClient = {} as DynamoDBClient;

  for (const op of OPS) {
    const camelCaseOp: string = `${op[0].toLowerCase()}${op.slice(1)}`;
    ddbc[camelCaseOp] = baseOp.bind(null, _conf, op);
  }

  return ddbc;
}
