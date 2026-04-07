import { ExecutionContext, Injectable } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context)
    const ctx = gqlCtx.getContext<{ req: Request; res: Response }>()
    // GraphQL context does not expose a response object — provide a no-op stub
    // so ThrottlerGuard.handleRequest can set rate-limit headers without crashing.
    const res = ctx.res ?? ({ header: () => undefined } as unknown as Response)
    return { req: ctx.req, res }
  }
}
