import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
  indentMultiline,
  RawClientSideBasePluginConfig,
} from '@graphql-codegen/visitor-plugin-common'
import autoBind from 'auto-bind'
import { GraphQLSchema, Kind, OperationTypeNode } from 'graphql'
import { OperationDefinitionNode } from 'graphql'

export class GraphQLRequestVisitor extends ClientSideBaseVisitor<
  RawClientSideBasePluginConfig,
  ClientSideBasePluginConfig
> {
  private _operationsToInclude: {
    node: OperationDefinitionNode
    documentVariableName: string
    operationType: string
    operationResultType: string
    operationVariablesTypes: string
  }[] = []

  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: RawClientSideBasePluginConfig,
  ) {
    super(schema, fragments, rawConfig, {})

    autoBind(this)

    this._additionalImports.push(
      `import { ApolloClient } from 'apollo-client';`,
      `import { FetchResult } from 'apollo-link';`,
    )
  }

  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string,
  ): string {
    this._operationsToInclude.push({
      node,
      documentVariableName,
      operationType,
      operationResultType,
      operationVariablesTypes,
    })

    return null
  }

  public get sdkContent(): string {
    const allPossibleActions = this._operationsToInclude
      .map(o => {
        const optionalVariables =
          !o.node.variableDefinitions ||
          o.node.variableDefinitions.length === 0 ||
          o.node.variableDefinitions.every(
            v => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue,
          )
        const doc = o.documentVariableName
        const method = this.getOperationMethod(o.node.operation)
        return `${o.node.name.value}(variables${
          optionalVariables ? '?' : ''
        }: ${o.operationVariablesTypes}): Promise<FetchResult<${
          o.operationResultType
        }>> {
  return client.${method}<${o.operationResultType}, ${
          o.operationVariablesTypes
        }>({
    ${o.node.operation}: ${doc},
    variables,${
      o.node.operation === 'query' ? `\n    fetchPolicy: 'network-only',` : ''
    }
  });
}`
      })
      .map(s => indentMultiline(s, 2))

    return `export function getSdk(client: ApolloClient<any>) {
  return {
${allPossibleActions.join(',\n')}
  };
}`
  }

  private getOperationMethod(operation: OperationTypeNode) {
    switch (operation) {
      case 'query': {
        return 'query'
      }
      case 'mutation': {
        return 'mutate'
      }
      default: {
        throw new Error(`unsupported operation: ${operation}`)
      }
    }
  }
}
