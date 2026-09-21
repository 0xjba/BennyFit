/**
 * Answering the loop's questions from a gold household's stored facts.
 *
 * During evaluation there is no person to ask, so the household's ground-truth facts
 * answer on their behalf. The replies are written the way someone would actually say
 * them rather than as flags, because the engine reads them as narrative and a reply of
 * "true" would be testing something other than what the system does in use.
 *
 * A criterion this oracle cannot answer returns null, and the loop records it as a
 * skipped question. That is honest: some criteria are not settled by the facts the
 * gold set stores, and pretending otherwise would flatter the question-relevance
 * figure.
 */

import { baseId } from '@/lib/criteria';
import type { GoldFacts } from '@/scripts/generate-gold';

const CATEGORICAL_NAMES: Record<string, string> = {
  ssi: 'SSI',
  tanf: 'TANF',
  ga: 'General Assistance',
};

export function oracleReply(instanceId: string, f: GoldFacts): string | null {
  const id = baseId(instanceId);

  switch (id) {
    case 'snap.income_source':
      if (f.earnedMonthly > 0 && f.unearnedMonthly > 0) {
        return 'Some of it is from my job and some is from benefits.';
      }
      if (f.earnedMonthly > 0) return 'It is all from my job.';
      if (f.unearnedMonthly > 0) return 'It is from benefits. I do not have a job.';
      return 'I have nothing coming in.';

    case 'snap.income_period':
      switch (f.statedPeriod) {
        case 'weekly':
          return 'That is what I get each week.';
        case 'biweekly':
          return 'That is every two weeks.';
        case 'annual':
          return 'That is for the whole year.';
        default:
          return 'That is per month.';
      }

    case 'snap.categorical':
      return f.categorical === 'none'
        ? 'No, none of us get any of those.'
        : `Yes, everyone here gets ${CATEGORICAL_NAMES[f.categorical]}.`;

    case 'snap.member_elderly_or_disabled':
      return f.hasElderlyOrDisabled
        ? 'Yes, that is right.'
        : 'No, nobody here is 60 or older or has a disability.';

    case 'snap.shelter_costs_reported':
      return f.rentMonthly > 0
        ? `Yes, rent is $${Math.round(f.rentMonthly)} a month.`
        : 'No, I do not pay rent.';

    case 'snap.utilities_paid_separately':
      return f.utilitiesMonthly > 0
        ? `Yes, about $${Math.round(f.utilitiesMonthly)} a month on top of rent.`
        : 'No, that is all included.';

    case 'snap.all_members_homeless':
      return f.allMembersHomeless ? 'Yes, we do not have a place right now.' : 'No, we have a place.';

    case 'snap.dependent_care_paid':
      return f.dependentCareMonthly > 0
        ? `Yes, $${Math.round(f.dependentCareMonthly)} a month for daycare.`
        : 'No, I do not pay for any care.';

    case 'snap.child_support_paid':
      return f.childSupportMonthly > 0
        ? `Yes, $${Math.round(f.childSupportMonthly)} a month.`
        : 'No, I do not pay child support.';

    case 'snap.medical_expenses':
      return f.medicalMonthly > 35
        ? `Yes, about $${Math.round(f.medicalMonthly)} a month.`
        : 'No, hardly anything.';

    case 'snap.resources_over_limit':
      return f.savings > 0
        ? `I have about $${Math.round(f.savings)} put away.`
        : 'No, I have nothing saved.';

    case 'snap.member_student':
      return 'No, nobody here is in college.';

    case 'snap.member_student_exemption':
      return null;

    case 'snap.member_citizenship':
      return 'We are all citizens.';

    case 'snap.household_purchases_together':
      return f.householdSize > 1
        ? 'Yes, we all buy and cook food together.'
        : 'It is only me, so yes.';

    case 'snap.self_employment':
      return 'No, it is a regular job.';

    case 'eitc.has_earned_income':
      return f.earnedMonthly > 0
        ? 'Yes, I work.'
        : 'No, nobody here worked for pay this year.';

    case 'eitc.filing_status':
      return f.filingStatus === 'joint'
        ? 'We file jointly, we are married.'
        : f.children > 0
          ? 'I file as head of household.'
          : 'I file single.';

    case 'eitc.separated_spouse_rules':
      return null;

    case 'eitc.investment_income_over_limit':
      return f.investmentIncome > 0
        ? `I made about $${Math.round(f.investmentIncome)} from investments.`
        : 'No, I have no investments.';

    case 'eitc.valid_ssn':
      return 'Yes, I have one.';

    case 'eitc.foreign_earned_income':
      return 'No, I live and work here.';

    case 'eitc.claimed_as_dependent':
      return 'No, nobody claims me.';

    case 'eitc.claimant_age_band':
      if (f.claimantAge < 25) return `I am ${f.claimantAge}.`;
      if (f.claimantAge >= 65) return `I am ${f.claimantAge}.`;
      return `I am ${f.claimantAge}.`;

    case 'eitc.child_relationship':
      return f.children > 0 ? 'They are my own children.' : null;

    case 'eitc.child_age':
      return f.children > 0 ? 'They are all young, still in school.' : null;

    case 'eitc.child_residency':
      return f.qualifyingChildren > 0
        ? 'They live with me all year.'
        : f.children > 0
          ? 'They stay with their other parent most of the time.'
          : null;

    case 'eitc.child_joint_return':
      return f.children > 0 ? 'No, they are children, they do not file.' : null;

    case 'eitc.child_claimed_elsewhere':
      return f.children > 0
        ? f.qualifyingChildren > 0
          ? 'No, only I claim them.'
          : 'Yes, their other parent claims them.'
        : null;

    case 'lifeline.receives_snap':
      return f.lifelinePrograms.includes('snap')
        ? 'Yes, we get SNAP.'
        : 'No, we do not get SNAP at the moment.';

    case 'lifeline.receives_medicaid':
      return f.lifelinePrograms.includes('medicaid') ? 'Yes, I have Medicaid.' : 'No, I do not.';

    case 'lifeline.receives_ssi':
      return f.categorical === 'ssi' || f.lifelinePrograms.includes('ssi')
        ? 'Yes, I get SSI.'
        : 'No, I do not get SSI.';

    case 'lifeline.receives_fpha':
      return f.lifelinePrograms.includes('fpha')
        ? 'Yes, I have a housing voucher.'
        : 'No, nothing like that.';

    case 'lifeline.receives_veterans_pension':
      return f.lifelinePrograms.includes('veterans_pension')
        ? 'Yes, I get a Veterans Pension.'
        : 'No, I do not.';

    case 'lifeline.tribal_lands':
      return f.onTribalLands ? 'Yes, we live on tribal land.' : 'No, we do not.';

    case 'lifeline.tribal_programs':
      return f.onTribalLands ? 'No, none of those.' : null;

    case 'lifeline.one_per_household':
      return 'No, nobody here has that already.';

    case 'va_pension.wartime_veteran':
      return f.wartimeVeteran
        ? 'Yes, I served during wartime.'
        : 'No, nobody here served in the military.';

    case 'va_pension.care_level':
      return 'Neither of those applies to me.';

    case 'cdctc.care_to_work':
    case 'cacfp.in_care':
      return f.dependentCareMonthly > 0
        ? `Yes, $${Math.round(f.dependentCareMonthly)} a month for care so I can work.`
        : 'No, I do not pay for any care.';

    case 'wap.has_home':
      return f.allMembersHomeless ? 'No, we do not have a place right now.' : 'Yes, we rent.';

    case 'summer_ebt.school_age_child':
    case 'chip.has_child':
      return f.childAges.length > 0
        ? `Yes, they are aged ${f.childAges.join(' and ')}.`
        : 'No, there are no children here.';

    case 'chip.child_uninsured':
      return f.childAges.length > 0 ? 'They do not have any coverage at the moment.' : null;

    case 'fdpir.near_reservation':
      return f.onTribalLands ? 'Yes, we live on tribal land.' : 'No, not near a reservation.';

    case 'sfmnp.member_60_plus':
      return f.claimantAge >= 60 ? 'Yes, I am over 60.' : 'No, nobody here is 60 yet.';

    case 'medicaid.already_enrolled':
      return f.lifelinePrograms.includes('medicaid') ? 'Yes, I have Medicaid.' : 'No, I do not.';

    case 'state_eitc.files_state_return':
      return 'Yes, I file a state return.';

    default:
      return null;
  }
}
