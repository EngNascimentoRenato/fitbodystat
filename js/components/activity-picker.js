import { activityCatalog } from "../data/activity-catalog.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";

function activityOption(activity, selected, fieldName) {
  return `
    <label class="activity-chip" data-category="${activity.category}">
      <input type="checkbox" name="${fieldName}" value="${escapeAttribute(activity.id)}" ${selected.has(activity.id) ? "checked" : ""} />
      <span>${escapeHtml(activity.label)}</span>
    </label>
  `;
}

export function activityPicker(preferredIds = [], selectedIds = [], customActivityName = "") {
  const preferred = new Set(preferredIds);
  const selected = new Set(selectedIds);
  const quickActivities = activityCatalog.filter((activity) => preferred.has(activity.id));
  const visibleQuick = quickActivities.length ? quickActivities : activityCatalog.slice(0, 6);
  const visibleQuickIds = new Set(visibleQuick.map((activity) => activity.id));
  const otherActivities = activityCatalog.filter((activity) => !visibleQuickIds.has(activity.id));
  const showMoreOpen = customActivityName || selectedIds.some((activityId) => !visibleQuickIds.has(activityId));

  return `
    <div class="field activity-picker-field">
      <label>O que você praticou?</label>
      <div class="activity-chip-grid">
        ${visibleQuick.map((activity) => activityOption(activity, selected, "activityTypeIds")).join("")}
      </div>
      <details class="activity-more" ${showMoreOpen ? "open" : ""}>
        <summary class="button">Outras atividades</summary>
        <div class="activity-chip-grid">
          ${otherActivities.map((activity) => activityOption(activity, selected, "activityTypeIds")).join("")}
        </div>
        <div class="field custom-activity-field">
          <label for="customActivityName">Atividade personalizada</label>
          <input id="customActivityName" name="customActivityName" maxlength="60" value="${escapeAttribute(customActivityName)}" />
        </div>
      </details>
    </div>
  `;
}

export function preferredActivityPicker(selectedIds = []) {
  const selected = new Set(selectedIds);
  return `
    <div class="activity-chip-grid preference-grid">
      ${activityCatalog.map((activity) => activityOption(activity, selected, "preferredActivities")).join("")}
    </div>
  `;
}
