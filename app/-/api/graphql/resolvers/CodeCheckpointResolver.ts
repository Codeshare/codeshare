import AppError from '~/helpers/AppError'
import idUtils from '@codeshare/id-utils'
import { CodeCheckpoint } from './nodes/Codeshare'
import { FieldResolver, Resolver, Root } from 'type-graphql'
import { CodeHistoryEdge } from './nodes/CodeHistory'
import codeHistoriesModel, { Row } from '~/models/codeHistories'
import { codesharesModel } from '../models/codeshares'
import { ignoreMessage } from 'ignore-errors'

@Resolver(() => CodeCheckpoint)
export default class CodeshareCodeCheckpointResolver {
  @FieldResolver(() => CodeHistoryEdge)
  async codeHistoryEdge(@Root() codeCheckpoint: CodeCheckpoint) {
    let node = await codeHistoriesModel.getOne(
      'id',
      codeCheckpoint.codeHistoryId,
    )

    // HACK: restore missing checkpoint
    if (node == null) {
      const idSplit = codeCheckpoint.codeHistoryId.split(':')
      const codeshareId = idSplit.shift() as string
      const historyId = idSplit.pop() as string
      const codeshare = await codesharesModel.getOne('id', codeshareId, [
        'id',
        'modifiedAt',
      ])
      if (codeshare != null) {
        await codeHistoriesModel
          .insert(
            {
              id: codeCheckpoint.codeHistoryId,
              codeshareId,
              historyId,
              createdAt: codeshare.modifiedAt,
              createdBy: codeCheckpoint!.createdBy,
              value: codeCheckpoint!.value,
            },
            [],
            {
              returnChanges: false,
            },
          )
          .catch(ignoreMessage(/already exists/))
        node = await codeHistoriesModel.getOne(
          'id',
          codeCheckpoint.codeHistoryId,
        )
      }
    }
    AppError.assert(node, 'codeCheckpoint "codeHistory" not found', {
      codeHistoryId: codeCheckpoint?.codeHistoryId,
    })

    return {
      node,
      cursor: idUtils.encodeRelayConnId(node.id),
    }
  }
  @FieldResolver()
  codeHistoryId(@Root() codeCheckpoint: CodeCheckpoint) {
    return idUtils.encodeRelayId('CodeHistory', codeCheckpoint.codeHistoryId)
  }
  @FieldResolver()
  async historyId(@Root() codeCheckpoint: CodeCheckpoint) {
    return codeCheckpoint.codeHistoryId.split(':').pop()
  }
}
