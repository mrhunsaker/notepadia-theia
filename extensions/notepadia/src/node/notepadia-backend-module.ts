import { ContainerModule } from '@theia/core/shared/inversify';
import { WorkspaceServer } from '@theia/workspace/lib/common';
import { DefaultWorkspaceServer } from '@theia/workspace/lib/node/default-workspace-server';
import { NotepadiaWorkspaceServer } from './notepadia-workspace-server';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(NotepadiaWorkspaceServer).toSelf().inSingletonScope();
    rebind(DefaultWorkspaceServer).toService(NotepadiaWorkspaceServer);
    rebind(WorkspaceServer).toService(NotepadiaWorkspaceServer);
});
