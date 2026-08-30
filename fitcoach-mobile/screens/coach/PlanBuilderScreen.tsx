// Plan builder shell — decides which editor to show and where its initial
// values come from: a client's live plan, or a template from the coach's
// library. All editing UI lives in components/plan.
import React from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../lib/api/api';
import type { DietPlan, PlanTemplate, PlansBundle, WorkoutPlan } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { LoadingView } from '../../components/ui';
import { DietPlanForm, WorkoutPlanForm } from '../../components/plan';
import { C } from '../../theme/tokens';
import type { CoachStackParamList } from '../../navigation/types';

export default function PlanBuilderScreen({ route, navigation }: NativeStackScreenProps<CoachStackParamList, 'PlanBuilder'>) {
  const { clientId, kind, clientName, mode, templateId } = route.params;
  const isTemplate = mode === 'template';
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  const plansQ = useQuery({
    queryKey: ['plans', me.id, clientId],
    queryFn: () => request<PlansBundle>('plans.get', { coachId: me.id, clientId }),
    enabled: !isTemplate && !!clientId,
  });
  const templatesQ = useQuery({
    queryKey: ['templates'],
    queryFn: () => request<PlanTemplate[]>('templates.list'),
    enabled: isTemplate,
  });

  if (isTemplate ? templatesQ.isLoading : plansQ.isLoading) {
    return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView label="Loading…" /></View>;
  }

  const template = isTemplate ? templatesQ.data?.find((t) => t.id === templateId) ?? null : null;

  const afterSave = () => {
    qc.invalidateQueries({ queryKey: ['plans'] });
    qc.invalidateQueries({ queryKey: ['coach'] });
    qc.invalidateQueries({ queryKey: ['templates'] });
    showToast(
      isTemplate ? 'Template saved to your library' : kind === 'workout'
        ? 'Workout plan published — your client can see it now'
        : 'Nutrition plan published — your client can see it now',
      'success'
    );
    navigation.goBack();
  };

  const common = {
    kind,
    isTemplate,
    templateId: template?.id,
    initialNote: template?.note ?? '',
    clientId,
    clientName,
    onSaved: afterSave,
  };

  return kind === 'workout' ? (
    <WorkoutPlanForm {...common} existing={workoutFrom(template, plansQ.data)} />
  ) : (
    <DietPlanForm {...common} existing={dietFrom(template, plansQ.data)} />
  );
}

/** Editing a template seeds the form from the template's stored content. */
function workoutFrom(template: PlanTemplate | null, plans: PlansBundle | undefined): WorkoutPlan | null {
  if (!template) return plans?.workout ?? null;
  if (!template.days) return null;
  return {
    id: '', coachId: '', clientId: '', updatedAt: '',
    title: template.title,
    days: template.days,
  };
}

function dietFrom(template: PlanTemplate | null, plans: PlansBundle | undefined): DietPlan | null {
  if (!template) return plans?.diet ?? null;
  if (!template.diet) return null;
  return {
    id: '', coachId: '', clientId: '', updatedAt: '',
    title: template.title,
    targetKcal: template.diet.targetKcal,
    meals: template.diet.meals,
    notes: template.diet.notes,
  };
}
