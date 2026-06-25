'use client';

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { toMissionTitle } from './mission-labels';
import {
  JourneyGuideFloatingButton,
  JourneyGuideProbe,
  JourneyGuideSpeech,
  JourneyGuideWelcome,
} from './JourneyGuide';
import { useJourneyGuideContext } from './JourneyGuideProvider';

type Anchor = { x: number; y: number } | null;

function resolveNodeAnchor(nodeId: string | null): Anchor {
  if (!nodeId || typeof document === 'undefined') {
    return null;
  }
  const stage = document.querySelector('.le-galaxy-viewport__stage');
  const node = document.querySelector(`[data-galaxy-node-id="${nodeId}"]`);
  if (!stage || !node) {
    return null;
  }
  const stageRect = stage.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  return {
    x: nodeRect.left - stageRect.left + nodeRect.width * 0.72,
    y: nodeRect.top - stageRect.top + nodeRect.height * 0.35,
  };
}

export function JourneyGuideLayer() {
  const guide = useJourneyGuideContext();
  const [anchor, setAnchor] = useState<Anchor>(null);

  const targetNodeId = useMemo(() => {
    if (guide.lockedGuide) {
      return guide.lockedGuide.prerequisiteIds[0] ?? guide.lockedGuide.nodeId;
    }
    if (guide.panelOpen || guide.mode === 'guided') {
      return guide.recommendedNodeId;
    }
    return null;
  }, [guide.lockedGuide, guide.mode, guide.panelOpen, guide.recommendedNodeId]);

  const refreshAnchor = () => setAnchor(resolveNodeAnchor(targetNodeId));

  useLayoutEffect(() => {
    refreshAnchor();
  }, [targetNodeId, guide.recommendation, guide.showWelcome]);

  useEffect(() => {
    const onResize = () => refreshAnchor();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [targetNodeId]);

  const probeState =
    guide.routePreview || guide.discovery
      ? 'highlighting'
      : guide.panelOpen || guide.lockedGuide
        ? 'speaking'
        : 'idle';

  const stuckHint =
    guide.persisted.lockedClickCount >= 2 &&
    !guide.panelOpen &&
    guide.recommendation &&
    guide.mode === 'guided' &&
    guide.assistanceStage <= 2;

  const showGuidePanel = guide.panelOpen || Boolean(guide.lockedGuide) || stuckHint;

  return (
    <>
      {guide.ambientDimActive && !guide.showWelcome && (
        <div
          className={`journey-guide-ambient${guide.routePreview ? ' journey-guide-ambient--route-preview' : ''}`}
          aria-hidden="true"
        />
      )}

      {guide.showWelcome && (
        <div className="journey-guide-layer journey-guide-layer--welcome" aria-hidden={false}>
          <JourneyGuideWelcome onStartGuided={guide.startGuidedJourney} onExploreAlone={guide.exploreOnMyOwn} />
        </div>
      )}

      {guide.discovery && (
        <div className="journey-guide-discovery" role="status" aria-live="polite">
          <JourneyGuideProbe state="highlighting" />
          <p>New routes discovered.</p>
        </div>
      )}

      {(showGuidePanel) && !guide.showWelcome && (
        <div
          className="journey-guide-layer journey-guide-layer--anchored"
          style={
            anchor
              ? ({ '--guide-x': `${anchor.x}px`, '--guide-y': `${anchor.y}px` } as CSSProperties)
              : undefined
          }
        >
          <div className="journey-guide-anchor">
            <JourneyGuideProbe state={probeState} />
            <JourneyGuideSpeech
              title={guide.lockedGuide ? 'Destination locked' : 'Recommended next step'}
              onClose={guide.closePanel}
            >
              {guide.lockedGuide ? (
                <>
                  <p>
                    <strong>{toMissionTitle(guide.lockedGuide.nodeId, guide.lockedGuide.title)}</strong> is not yet
                    accessible.
                  </p>
                  <p className="journey-guide-speech__label">Required steps</p>
                  <ul className="journey-guide-speech__list">
                    {guide.lockedGuide.prerequisiteTitles.map((title, index) => (
                      <li key={guide.lockedGuide!.prerequisiteIds[index]}>
                        {toMissionTitle(guide.lockedGuide!.prerequisiteIds[index]!, title)}
                      </li>
                    ))}
                  </ul>
                  {guide.lockedGuide.prerequisiteIds[0] && (
                    <button
                      type="button"
                      className="journey-guide-btn journey-guide-btn--primary"
                      onClick={() => guide.goToPrerequisite(guide.lockedGuide!.prerequisiteIds[0]!)}
                    >
                      Take Me There
                    </button>
                  )}
                </>
              ) : guide.recommendation ? (
                <>
                  <p className="journey-guide-speech__mission">{guide.recommendation.missionTitle}</p>
                  <p>{guide.recommendation.reason}</p>
                  {guide.recommendation.unlockPreview.length > 0 && (
                    <>
                      <p className="journey-guide-speech__label">Completing this unlocks</p>
                      <ul className="journey-guide-speech__list">
                        {guide.recommendation.unlockPreview.map((entry) => (
                          <li key={entry.nodeId}>{entry.missionTitle}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <button
                    type="button"
                    className="journey-guide-btn journey-guide-btn--ghost"
                    onClick={() => guide.triggerRoutePreview()}
                  >
                    Preview route
                  </button>
                </>
              ) : (
                <>
                  <p>Need help finding your next step? Select any available planet to continue your journey.</p>
                  {guide.mode === 'independent' && (
                    <button
                      type="button"
                      className="journey-guide-btn journey-guide-btn--ghost"
                      onClick={guide.resumeGuidedJourney}
                    >
                      Resume guided journey
                    </button>
                  )}
                </>
              )}
            </JourneyGuideSpeech>
          </div>
        </div>
      )}

      {(guide.mode === 'independent' && !guide.showWelcome && !guide.panelOpen && !guide.lockedGuide) && (
        <JourneyGuideFloatingButton onClick={guide.openPanel} />
      )}
    </>
  );
}
