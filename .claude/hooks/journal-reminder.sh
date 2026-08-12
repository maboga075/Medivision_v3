#!/usr/bin/env bash
#
# Hook Stop — rappelle à Claude de tenir JOURNAL.md à jour.
#
# Se déclenche UNIQUEMENT si des fichiers de code (src/ ou api/) sont modifiés
# dans le working tree alors que JOURNAL.md ne l'est pas. Émet alors un rappel
# (exit 2 = block sur un hook Stop → le message stderr est renvoyé à Claude, qui
# reprend la main pour mettre à jour le journal).
#
# Anti-boucle :
#   1. `stop_hook_active` : si Claude reprend DÉJÀ à la suite de ce hook, on ne
#      redéclenche pas → au plus UN rappel par arrêt.
#   2. Dès que JOURNAL.md est modifié, la condition devient fausse.
#
set -euo pipefail

input="$(cat)"

# 1. Garde anti-boucle : ne jamais re-bloquer une continuation déjà issue du hook.
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" 2>/dev/null || exit 0

# Pas un dépôt git → rien à comparer, on n'importune pas.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

code_changed="$(git status --porcelain -- src api 2>/dev/null | head -n 1)"
journal_changed="$(git status --porcelain -- JOURNAL.md 2>/dev/null | head -n 1)"

if [ -n "$code_changed" ] && [ -z "$journal_changed" ]; then
  echo "Rappel JOURNAL.md : des fichiers de code (src/ ou api/) ont été modifiés mais JOURNAL.md ne l'a pas été. Avant de conclure, ajoute une entrée de session à JOURNAL.md (ce qui a changé, pourquoi, statut des vérifications tsc/tests/build). Si cette tâche ne justifie objectivement aucune entrée (exploration, question sans modification fonctionnelle), tu peux ignorer ce rappel — il ne se redéclenchera pas." >&2
  exit 2
fi

exit 0
