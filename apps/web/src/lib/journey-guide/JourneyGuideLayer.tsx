'use client';

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '@/components/AppProvider';
import { buildOverlayTitle, buildUnlockGuideMessage } from './cinematic-unlock-engine';
import { toMissionTitle } from './mission-labels';
import {
  JourneyGuideFloatingButton,
  JourneyGuideProbe,
  JourneyGuideSpeech,
  JourneyGuideWelcome,
  CinematicDiscoveryOverlay,
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
  const { t } = useApp();
  const [anchor, setAnchor] = useState<Anchor>(null);

  const targetNodeId = useMemo(() => {
    if (guide.cinematicUnlock?.phase === 'guide') {
      return (
        guide.cinematicUnlock.newlyUnlockedNodeIds[0] ??
        guide.cinematicUnlock.sourceNodeId
      );
    }
    if (guide.lockedGuide) {
      return guide.lockedGuide.prerequisiteIds[0] ?? guide.lockedGuide.nodeId;
    }
    if (guide.panelOpen || guide.mode === 'guided') {
      return guide.recommendedNodeId;
    }
    return null;
  }, [guide.cinematicUnlock, guide.lockedGuide, guide.mode, guide.panelOpen, guide.recommendedNodeId]);

  const refreshAnchor = () => setAnchor(resolveNodeAnchor(targetNodeId));

  useLayoutEffect(() => {
    refreshAnchor();
  }, [targetNodeId, guide.recommendation, guide.showWelcome]);

  useEffect(() => {
    const onResize = () => refreshAnchor();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [targetNodeId]);

  const cinematicCopy = useMemo(() => {
    if (!guide.cinematicUnlock) {
      return null;
    }
    const unlock = guide.cinematicUnlock;
    const sourceLabel = toMissionTitle(unlock.sourceNodeId, unlock.sourceTitle, t);
    const destinationLabels = unlock.newlyUnlockedNodeIds.map((id, index) =>
      toMissionTitle(id, unlock.newlyUnlockedTitles[index] ?? id, t)
    );
    const message = buildUnlockGuideMessage(sourceLabel, destinationLabels, t);
    return {
      guideTitle: message.title,
      guideBody: message.body,
      overlayTitle: buildOverlayTitle(unlock.newlyUnlockedNodeIds.length, t),
      destinations: destinationLabels,
    };
  }, [guide.cinematicUnlock, t]);

  const probeState =
    guide.cinematicUnlock && guide.cinematicUnlock.phase !== 'guide'
      ? 'highlighting'
      : guide.routePreview
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

  const showGuidePanel =
    guide.panelOpen || Boolean(guide.lockedGuide) || stuckHint || guide.cinematicUnlock?.phase === 'guide';

  const speechTitle =
    guide.cinematicUnlock?.phase === 'guide'
      ? cinematicCopy?.guideTitle
      : guide.lockedGuide
        ? t('guide.destinationLocked')
        : t('guide.recommendedNextStep');

  return (
    <>
      {guide.ambientDimActive && !guide.showWelcome && (
        <div
          className={`journey-guide-ambient${
            guide.routePreview ? ' journey-guide-ambient--route-preview' : ''
          }${guide.cinematicUnlock ? ' journey-guide-ambient--cinematic-unlock' : ''}`}
          aria-hidden="true"
        />
      )}

      {guide.showWelcome && (
        <div className="journey-guide-layer journey-guide-layer--welcome" aria-hidden={false}>
          <JourneyGuideWelcome onStartGuided={guide.startGuidedJourney} onExploreAlone={guide.exploreOnMyOwn} />
        </div>
      )}

      {guide.cinematicUnlock?.phase === 'overlay' && cinematicCopy && (
        <CinematicDiscoveryOverlay
          title={cinematicCopy.overlayTitle}
          destinations={cinematicCopy.destinations}
        />
      )}

      {showGuidePanel && !guide.showWelcome && (
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
            <JourneyGuideSpeech title={speechTitle} onClose={guide.closePanel}>
              {guide.cinematicUnlock?.phase === 'guide' && cinematicCopy ? (
                <>
                  <p>{cinematicCopy.guideBody}</p>
                  {guide.canReplayUnlock && (
                    <button
                      type="button"
                      className="journey-guide-btn journey-guide-btn--ghost"
                      onClick={guide.replayCinematicUnlock}
                    >
                      {t('guide.replayDiscovery')}
                    </button>
                  )}
                </>
              ) : guide.lockedGuide ? (
                <>
                  <p>
                    <strong>{toMissionTitle(guide.lockedGuide.nodeId, guide.lockedGuide.title, t)}</strong>
                    {t('guide.lockedNotAccessibleRest')}
                  </p>
                  <p className="journey-guide-speech__label">{t('guide.requiredSteps')}</p>
                  <ul className="journey-guide-speech__list">
                    {guide.lockedGuide.prerequisiteTitles.map((title, index) => (
                      <li key={guide.lockedGuide!.prerequisiteIds[index]}>
                        {toMissionTitle(guide.lockedGuide!.prerequisiteIds[index]!, title, t)}
                      </li>
                    ))}
                  </ul>
                  {guide.lockedGuide.prerequisiteIds[0] && (
                    <button
                      type="button"
                      className="journey-guide-btn journey-guide-btn--primary"
                      onClick={() => guide.goToPrerequisite(guide.lockedGuide!.prerequisiteIds[0]!)}
                    >
                      {t('guide.takeMeThere')}
                    </button>
                  )}
                </>
              ) : guide.recommendation ? (
                <>
                  <p className="journey-guide-speech__mission">{guide.recommendation.missionTitle}</p>
                  <p>{guide.recommendation.reason}</p>
                  {guide.recommendation.unlockPreview.length > 0 && (
                    <>
                      <p className="journey-guide-speech__label">{t('guide.completingUnlocks')}</p>
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
                    {t('guide.previewRoute')}
                  </button>
                  {guide.canReplayUnlock && (
                    <button
                      type="button"
                      className="journey-guide-btn journey-guide-btn--ghost"
                      onClick={guide.replayCinematicUnlock}
                    >
                      {t('guide.replayDiscovery')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>{t('guide.emptyHelp')}</p>
                  {guide.mode === 'independent' && (
                    <button
                      type="button"
                      className="journey-guide-btn journey-guide-btn--ghost"
                      onClick={guide.resumeGuidedJourney}
                    >
                      {t('guide.resumeGuided')}
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
