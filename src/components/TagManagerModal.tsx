import React, { useState } from 'react';
import { Tag as TagIcon, Plus, Trash2, Globe, Clock, User, Check, AlertCircle } from 'lucide-react';
import type { TagInfo, CreateTagOptions } from '../types';

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: TagInfo[];
  currentHeadSha?: string;
  onRefreshTags: () => Promise<void>;
  onCreateTag: (options: CreateTagOptions) => Promise<void>;
  onDeleteTag: (tagName: string) => Promise<void>;
  onPushTag?: (tagName: string) => Promise<void>;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen,
  onClose,
  tags,
  currentHeadSha,
  onRefreshTags,
  onCreateTag,
  onDeleteTag,
  onPushTag,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [tagName, setTagName] = useState('');
  const [targetSha, setTargetSha] = useState('');
  const [message, setMessage] = useState('');
  const [isAnnotated, setIsAnnotated] = useState(true);
  const [isForce, setIsForce] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [pushingTag, setPushingTag] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setError('Tag name is required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateTag({
        name: tagName.trim(),
        target_sha: targetSha.trim() || undefined,
        message: isAnnotated && message.trim() ? message.trim() : undefined,
        force: isForce,
      });
      setTagName('');
      setTargetSha('');
      setMessage('');
      setIsForce(false);
      await onRefreshTags();
      setActiveTab('list');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tag: string) => {
    if (!confirm(`Are you sure you want to delete tag "${tag}"?`)) return;
    setDeletingTag(tag);
    try {
      await onDeleteTag(tag);
      await onRefreshTags();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingTag(null);
    }
  };

  const handlePush = async (tag: string) => {
    if (!onPushTag) return;
    setPushingTag(tag);
    try {
      await onPushTag(tag);
      alert(`Tag ${tag} successfully pushed to remote.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPushingTag(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Git Tags &amp; Release Markers
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {tags.length}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-500">
                Lightweight and annotated Git tags (Level 1 reversible metadata)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 pt-2 bg-zinc-50/30 dark:bg-zinc-800/20 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'list'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Tags List ({tags.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'create'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Tag</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'list' ? (
            tags.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                <TagIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No tags found in this repository.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Tag</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tags.map((t) => (
                  <div
                    key={t.name}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <TagIcon className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-[13px] truncate">
                          {t.name}
                        </span>
                        {t.is_annotated ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            annotated
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            lightweight
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-zinc-400">
                          {t.short_sha}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onPushTag && (
                          <button
                            type="button"
                            onClick={() => handlePush(t.name)}
                            disabled={pushingTag === t.name}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                            title={`Push tag ${t.name} to remote`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(t.name)}
                          disabled={deletingTag === t.name}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title={`Delete tag ${t.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {t.message && (
                      <p className="mt-1.5 text-zinc-600 dark:text-zinc-300 font-sans text-xs bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                        {t.message}
                      </p>
                    )}

                    {(t.tagger_name || t.tagger_date) && (
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                        {t.tagger_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-zinc-400" />
                            <span>{t.tagger_name}</span>
                          </span>
                        )}
                        {t.tagger_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>{t.tagger_date.split(' ')[0]}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. v1.0.0 or release-2026-03"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Commit SHA (Optional, defaults to HEAD)
                </label>
                <input
                  type="text"
                  value={targetSha}
                  onChange={(e) => setTargetSha(e.target.value)}
                  placeholder={currentHeadSha ? `HEAD (${currentHeadSha.slice(0, 7)})` : 'HEAD'}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnnotated}
                    onChange={(e) => setIsAnnotated(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                    Annotated Tag (-a)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isForce}
                    onChange={(e) => setIsForce(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                    Force replace existing (-f)
                  </span>
                </label>
              </div>

              {isAnnotated && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tag Annotation Message (-m)
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Release v1.0.0 notes and details..."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-sans text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !tagName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Creating...' : 'Create Tag'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40 shrink-0">
          <span className="text-[11px] text-zinc-400 font-mono">
            Direct Git CLI: git tag [-a] [-f] &lt;name&gt; [&lt;commit&gt;]
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
