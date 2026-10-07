"use client";

import { useState, type FC, type MutableRefObject } from "react";
import {
  numberToUSLocale,
  ShowMoreOrAll,
  StyledLabelChip,
  StyledRelationshipChip,
  WarningMessage,
} from "neo4j-arc/common";
import type { OverviewPaneProps } from "neo4j-arc/graph-visualization";

const OVERVIEW_STEP_SIZE = 50;

export type TypeLegend = {
  labels: Record<string, number>;
  relTypes: Record<string, number>;
};

export type TypeFocusHandlers = {
  legend: TypeLegend;
  selectedLabels: ReadonlySet<string>;
  selectedRelTypes: ReadonlySet<string>;
  onToggleLabel: (label: string) => void;
  onToggleRelType: (relType: string) => void;
};

type SectionHeaderProps = {
  title: string;
  numOfElementsVisible: number;
  totalNumOfElements: number;
};

function SectionHeader({
  title,
  numOfElementsVisible,
  totalNumOfElements,
}: SectionHeaderProps) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ fontWeight: 700 }}>{title}</span>
      {numOfElementsVisible < totalNumOfElements && (
        <span style={{ fontSize: "0.9rem" }}>
          {`(showing ${numOfElementsVisible} of ${totalNumOfElements})`}
        </span>
      )}
    </div>
  );
}

function isStarPressed(selected: ReadonlySet<string>): boolean {
  return selected.size === 0;
}

/**
 * Factory so GraphVisualizer gets a stable Overview override that reads
 * latest selection via ref (avoids remounting the inspector on each toggle).
 */
export function createClickableOverviewPane(
  handlersRef: MutableRefObject<TypeFocusHandlers>,
): FC<OverviewPaneProps> {
  return function ClickableOverviewPane({
    graphStyle,
    hasTruncatedFields,
    nodeCount,
    relationshipCount,
    infoMessage,
  }: OverviewPaneProps) {
    const [maxLabelsCount, setMaxLabelsCount] = useState(OVERVIEW_STEP_SIZE);
    const [maxRelationshipsCount, setMaxRelationshipsCount] =
      useState(OVERVIEW_STEP_SIZE);
    // Force re-render when chips are clicked so pressed/dim styles update
    // even though handlers live in a ref.
    const [, bump] = useState(0);

    const {
      legend,
      selectedLabels,
      selectedRelTypes,
      onToggleLabel,
      onToggleRelType,
    } = handlersRef.current;

    const labelKeys = Object.keys(legend.labels);
    const relKeys = Object.keys(legend.relTypes);
    const visibleLabelKeys = labelKeys.slice(0, maxLabelsCount);
    const visibleRelKeys = relKeys.slice(0, maxRelationshipsCount);
    const labelFilterActive = selectedLabels.size > 0;
    const relFilterActive = selectedRelTypes.size > 0;

    const toggleLabel = (label: string) => {
      onToggleLabel(label);
      bump((n) => n + 1);
    };
    const toggleRel = (relType: string) => {
      onToggleRelType(relType);
      bump((n) => n + 1);
    };

    return (
      <div
        style={{
          padding: "0 14px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 16, marginTop: 10, flex: "0 0 auto" }}>
          Overview
        </div>
        <div
          style={{
            height: "100%",
            overflow: "auto",
            margin: "14px 0",
            flex: "0 1 auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {visibleLabelKeys.length > 0 && (
            <div>
              <SectionHeader
                title="Node labels"
                numOfElementsVisible={visibleLabelKeys.length}
                totalNumOfElements={labelKeys.length}
              />
              <ul
                style={{
                  listStyle: "none",
                  padding: "4px 0 0 0",
                  margin: 0,
                  wordBreak: "break-word",
                }}
                aria-label="Node labels"
              >
                {visibleLabelKeys.map((label) => {
                  const pressed =
                    label === "*"
                      ? isStarPressed(selectedLabels)
                      : selectedLabels.has(label);
                  const dim = labelFilterActive && !pressed;
                  const nodeStyle = graphStyle.forNode({
                    labels: label === "*" ? [] : [label],
                  });
                  return (
                    <li key={label} style={{ display: "inline-block" }}>
                      <StyledLabelChip
                        as="button"
                        type="button"
                        onClick={() => toggleLabel(label)}
                        aria-pressed={pressed}
                        aria-label={
                          label === "*"
                            ? "Show all node labels"
                            : `Focus node label ${label}, ${legend.labels[label] ?? 0} nodes`
                        }
                        style={{
                          backgroundColor: nodeStyle.get("color"),
                          color: nodeStyle.get("text-color-internal"),
                          outline: pressed ? "2px solid #1a1a1a" : undefined,
                          outlineOffset: pressed ? 2 : undefined,
                          opacity: dim ? 0.45 : 1,
                          cursor: "pointer",
                          border: "none",
                          font: "inherit",
                        }}
                      >
                        {`${label} (${legend.labels[label] ?? 0})`}
                      </StyledLabelChip>
                    </li>
                  );
                })}
              </ul>
              <ShowMoreOrAll
                total={labelKeys.length}
                shown={visibleLabelKeys.length}
                moreStep={OVERVIEW_STEP_SIZE}
                onMore={(n) => setMaxLabelsCount((c) => c + n)}
              />
            </div>
          )}

          {visibleRelKeys.length > 0 && (
            <div>
              <SectionHeader
                title="Relationship types"
                numOfElementsVisible={visibleRelKeys.length}
                totalNumOfElements={relKeys.length}
              />
              <ul
                style={{
                  listStyle: "none",
                  padding: "4px 0 0 0",
                  margin: 0,
                  wordBreak: "break-word",
                }}
                aria-label="Relationship types"
              >
                {visibleRelKeys.map((relType) => {
                  const pressed =
                    relType === "*"
                      ? isStarPressed(selectedRelTypes)
                      : selectedRelTypes.has(relType);
                  const dim = relFilterActive && !pressed;
                  const relStyle = graphStyle.forRelationship({ type: relType });
                  return (
                    <li key={relType} style={{ display: "inline-block" }}>
                      <StyledRelationshipChip
                        as="button"
                        type="button"
                        onClick={() => toggleRel(relType)}
                        aria-pressed={pressed}
                        aria-label={
                          relType === "*"
                            ? "Show all relationship types"
                            : `Focus relationship type ${relType}, ${legend.relTypes[relType] ?? 0} relationships`
                        }
                        style={{
                          backgroundColor: relStyle.get("color"),
                          color: relStyle.get("text-color-internal"),
                          outline: pressed ? "2px solid #1a1a1a" : undefined,
                          outlineOffset: pressed ? 2 : undefined,
                          opacity: dim ? 0.45 : 1,
                          cursor: "pointer",
                          border: "none",
                          font: "inherit",
                        }}
                      >
                        {`${relType} (${legend.relTypes[relType] ?? 0})`}
                      </StyledRelationshipChip>
                    </li>
                  );
                })}
              </ul>
              <ShowMoreOrAll
                total={relKeys.length}
                shown={visibleRelKeys.length}
                moreStep={OVERVIEW_STEP_SIZE}
                onMore={(n) => setMaxRelationshipsCount((c) => c + n)}
              />
            </div>
          )}

          <div style={{ paddingBottom: 10 }}>
            {hasTruncatedFields && (
              <>
                <WarningMessage text="Record fields have been truncated." />
                <br />
              </>
            )}
            {infoMessage && (
              <>
                <WarningMessage text={infoMessage} />
                <br />
              </>
            )}
            {nodeCount !== null &&
              relationshipCount !== null &&
              `Displaying ${numberToUSLocale(nodeCount)} nodes, ${numberToUSLocale(relationshipCount)} relationships.`}
          </div>
        </div>
      </div>
    );
  };
}
