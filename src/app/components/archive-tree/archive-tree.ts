import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, input } from '@angular/core';
import type { TreeNode } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { TreeModule } from 'primeng/tree';
import { FormatBytesPipe } from '../../utils/format-bytes.pipe';
import { ArchiveEntriesResponseSchema, type ArchiveEntriesResponse } from '../../../shared/types';

interface ArchiveNode {
  /** Bytes in the file, or in everything below the folder. */
  size: number;
  /** Where the entry is served, when the archive is hosted and it lies inside the site root. */
  url: string | null;
}

/** The contents of a zip archive as a folder tree, read from `/api/files/:id/entries`. */
@Component({
  selector: 'app-archive-tree',
  templateUrl: './archive-tree.html',
  imports: [FormatBytesPipe, MessageModule, TreeModule],
})
export class ArchiveTree {
  readonly fileId = input.required<string>();
  /** Root URL of the hosted site, if the archive is hosted. */
  readonly siteUrl = input<string | null>(null);

  protected readonly archive = httpResource(
    () => ({ url: `/api/files/${encodeURIComponent(this.fileId())}/entries` }),
    { parse: (value) => ArchiveEntriesResponseSchema.parse(value) },
  );

  protected readonly nodes = computed(() =>
    this.archive.hasValue() ? buildTree(this.archive.value(), this.siteUrl()) : [],
  );

  protected readonly errorMessage = computed(() => {
    const err = this.archive.error();
    if (!err) return '';

    const detail = err instanceof HttpErrorResponse ? err.error?.error : undefined;
    return typeof detail === 'string'
      ? `Could not read the archive: ${detail}`
      : 'Could not read the archive.';
  });
}

/**
 * Turns the flat entry list into nested folders, sorted folders-first. The
 * folder served as the site root starts expanded, since that is the part
 * anyone opening the tree is after.
 */
function buildTree(
  { root, entries }: ArchiveEntriesResponse,
  siteUrl: string | null,
): TreeNode<ArchiveNode>[] {
  const top: TreeNode<ArchiveNode>[] = [];
  const folders = new Map<string, TreeNode<ArchiveNode>>();

  const urlOf = (path: string) =>
    siteUrl && path.startsWith(root) ? siteUrl + encodePath(path.slice(root.length)) : null;

  /** The child list of folder `path` (`''` or ending in `/`), creating folders as needed. */
  const childrenOf = (path: string): TreeNode<ArchiveNode>[] => {
    if (!path) return top;

    let folder = folders.get(path);
    if (!folder) {
      const parent = path.slice(0, path.lastIndexOf('/', path.length - 2) + 1);
      folder = {
        key: path,
        label: path.slice(parent.length, -1),
        data: { size: 0, url: urlOf(path) },
        expandedIcon: 'pi pi-folder-open',
        collapsedIcon: 'pi pi-folder',
        expanded: path === root,
        children: [],
      };
      childrenOf(parent).push(folder);
      folders.set(path, folder);
    }
    return folder.children!;
  };

  for (const entry of entries) {
    const folder = entry.path.slice(0, entry.path.lastIndexOf('/') + 1);
    childrenOf(folder).push({
      key: entry.path,
      label: entry.path.slice(folder.length),
      data: { size: entry.size, url: urlOf(entry.path) },
      icon: 'pi pi-file',
      leaf: true,
    });
  }

  settle(top);
  return top;
}

/** Sorts folders-first by name and adds up folder sizes, bottom-up. */
function settle(nodes: TreeNode<ArchiveNode>[]): number {
  nodes.sort(
    (a, b) => Number(Boolean(a.leaf)) - Number(Boolean(b.leaf)) || a.label!.localeCompare(b.label!),
  );

  let total = 0;
  for (const node of nodes) {
    if (node.children) node.data!.size = settle(node.children);
    total += node.data!.size;
  }
  return total;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
