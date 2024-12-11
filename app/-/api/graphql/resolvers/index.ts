import CodeshareCodeHistoryResolver, {
  CodeshareCodeHistoryFieldResolver,
} from './CodeshareCodeHistoryResolver'
import CodeshareUserResolver, {
  CodeshareUserFieldResolver,
} from './CodeshareUserResolver'
import MeSubscriptionPlansResolver, {
  MeSubscriptionFieldResolver,
} from './MeSubscriptionPlansResolver'

import AdminViewerResolver from './AdminViewerResolver'
import CodeCheckpointResolver from './CodeCheckpointResolver'
import CodeshareResolver from './CodeshareResolver'
import CreatedByFieldResolver from '../fields/CreatedByFieldResolver'
import MeResolver from './MeResolver'
import ModifiedByFieldResolver from '../fields/ModifiedByFieldResolver'
import NodeResolver from './NodeResolver'
import PasswordResetResolver from './PasswordResetResolver'
import SubscriptionPlanResolver from './SubscriptionPlanResolver'
import UserResolver from './UserResolver'
import ViewerResolver from './ViewerResolver'

export default [
  CodeCheckpointResolver,
  NodeResolver,
  MeResolver,
  UserResolver,
  MeSubscriptionPlansResolver,
  MeSubscriptionFieldResolver,
  ModifiedByFieldResolver,
  CodeshareResolver,
  CodeshareUserResolver,
  CodeshareUserFieldResolver,
  CodeshareCodeHistoryResolver,
  CodeshareCodeHistoryFieldResolver,
  CreatedByFieldResolver,
  PasswordResetResolver,
  SubscriptionPlanResolver,
  ViewerResolver,
  AdminViewerResolver,
] as const
