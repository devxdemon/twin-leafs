import { min } from 'date-fns/fp';
import { describe, expect, test } from 'vitest';
import { getTaskColumns } from './utils/get-task-columns';
import { getTasks } from './utils/get-tasks';
import { getTotalWorkingDays } from './utils/get-total-working-days';
import { filterStandupTasks, filterStartedTasks } from './utils/task-filters';

describe('Tasks', async () => {
  const tasks = await getTasks();

  if (!tasks || tasks.length === 0) {
    console.log('No data found');
    return;
  }
  const workingDays = getTotalWorkingDays(tasks[0][8]);

  describe('Standup tasks', () => {
    const STANDUP_TITLE_SPLIT = '  ';
    const standupTasks = filterStandupTasks(tasks);

    // No duplicate tasks with same start-date or end-date or estimated-end-date
    test('Dates in all three columns are the same', () => {
      const startDatesMap: Map<string, number> = new Map();
      const endDatesMap: Map<string, number> = new Map();
      const actualEndDatesMap: Map<string, number> = new Map();

      for (const row of standupTasks) {
        const startDate = row[8];
        const endDate = row[9];
        const actualEndDate = row[10];

        // start-date
        const p1 = startDatesMap.get(startDate);
        if (p1 !== undefined) {
          startDatesMap.set(startDate, p1 + 1);
        } else {
          startDatesMap.set(startDate, 1);
        }

        // end-date
        const p2 = endDatesMap.get(endDate);
        if (p2 !== undefined) {
          endDatesMap.set(endDate, p2 + 1);
        } else {
          endDatesMap.set(endDate, 1);
        }

        // actual-end-date
        const p3 = actualEndDatesMap.get(actualEndDate);
        if (p3 !== undefined) {
          actualEndDatesMap.set(actualEndDate, p3 + 1);
        } else {
          actualEndDatesMap.set(actualEndDate, 1);
        }
      }

      const duplicateStartDates = Array.from(startDatesMap).filter(([_, count]) => count > 1);
      const duplicateEndDates = Array.from(endDatesMap).filter(([_, count]) => count > 1);
      const duplicateActualEndDates = Array.from(actualEndDatesMap).filter(([_, count]) => count > 1);

      expect(duplicateStartDates.length, `Found duplicates in start-date: ${JSON.stringify(duplicateStartDates, null, 2)}`).toBe(0);
      expect(duplicateEndDates.length, `Found duplicates in end-date: ${JSON.stringify(duplicateEndDates, null, 2)}`).toBe(0);
      expect(duplicateActualEndDates.length, `Found duplicates in actual-end-date: ${JSON.stringify(duplicateActualEndDates, null, 2)}`).toBe(0);
    });

    // Each working day has standup
    test('Each working day has standup task', () => {
      const startDates = standupTasks.map((t) => t[8]);

      // 1. Find all working dates that are NOT in startDates
      const missingDates = workingDays.workingDatesTillToday.filter((date) => !startDates.includes(date));

      // 2. Assert that no missing dates exist
      expect(missingDates, `Working dates with no standup task found: ${JSON.stringify(missingDates, null, 2)}`).toEqual([]);
    });

    // Standup with specified columns
    test('Standup with specified columns', () => {
      const unspecifiedColumns = standupTasks.filter((t) => {
        const { project, subProject, appSide, taskType, workCategory, priority, status } = getTaskColumns(t);

        return (
          project !== '' ||
          subProject !== '' ||
          appSide !== '' ||
          taskType !== 'Daily Standup' ||
          workCategory !== 'Planned' ||
          priority !== 'High' ||
          status !== 'Recurring'
        );
      });

      expect(unspecifiedColumns, `Unspecific columns in standup tasks: ${JSON.stringify(unspecifiedColumns, null, 2)}`).toEqual([]);
    });

    // Dates in all three columns are the same
    test('Dates in all three columns are the same', () => {
      const unmatchedDates = standupTasks.filter((t) => {
        const { startDate, endDate, actualEndDate } = getTaskColumns(t);
        return startDate !== endDate || endDate !== actualEndDate;
      });

      expect(unmatchedDates, `Unmatched dates in the standup task: ${JSON.stringify(unmatchedDates, null, 2)}`).toEqual([]);
    });

    // Prefix for task title
    test('Prefix for task title', () => {
      const unmatchedTitle = standupTasks.filter((t) => {
        const { title } = getTaskColumns(t);
        const [prefix] = title.split(STANDUP_TITLE_SPLIT);
        return prefix !== 'Daily Standup Call';
      });
      expect(unmatchedTitle, `Unmatched standup title: ${JSON.stringify(unmatchedTitle, null, 2)}`).toEqual([]);
    });

    // Task date and date in title should be same
    test('Task date and date in title should be same', () => {
      const unmatchedTitleDates = standupTasks.filter((t) => {
        const { title, startDate } = getTaskColumns(t);
        const [_, sufix] = title.split(STANDUP_TITLE_SPLIT);
        return sufix !== startDate;
      });
      expect(unmatchedTitleDates, `Unmatched sufix in standup title: ${JSON.stringify(unmatchedTitleDates, null, 2)}`).toEqual([]);
    });
  });

  describe('Tasks time', () => {
    const startedTasks = filterStartedTasks(tasks);

    // Task estimated-hours should be divided by 0.25
    test('Task estimated-hours should be divided by 0.25', () => {
      const incorrectHoursInTasks = startedTasks.filter((t) => {
        const { estimatedHours } = getTaskColumns(t);
        if (estimatedHours === '') return true;

        const hours = Number(estimatedHours);
        if (Number.isNaN(hours)) return true;

        return hours % 0.25 !== 0;
      });
      expect(incorrectHoursInTasks, `Incorrect format for the estimate-hours: ${JSON.stringify(incorrectHoursInTasks, null, 2)}`).toEqual([]);
    });

    // Task actual-hours should be divided by 0.25
    test('Task actual-hours should be divided by 0.25', () => {
      const incorrectHoursInTasks = startedTasks.filter((t) => {
        const { actualHours } = getTaskColumns(t);
        if (actualHours === '') return true;

        const hours = Number(actualHours);
        if (Number.isNaN(hours)) return true;

        return hours % 0.25 !== 0;
      });
      expect(incorrectHoursInTasks, `Incorrect format for the actual-hours: ${JSON.stringify(incorrectHoursInTasks, null, 2)}`).toEqual([]);
    });
  });

  describe('Task status', () => {
    // Atmost one task should be in-progress
    test('Atmost one task should be in-progress', () => {
      const inProgressTasks = tasks.filter((t) => {
        const { status } = getTaskColumns(t);
        return status === 'In Progress';
      });

      expect(inProgressTasks.length, `Atmost one task should be in-progress: ${JSON.stringify(inProgressTasks, null, 2)}`).toBeLessThanOrEqual(1);
    });

    // Each onhold task should have comment on why the task is being onhold
    test('Each onhold task should have comment on why the task is being onhold', () => {
      const onHoldTasks = tasks.filter((t) => {
        const { status, comment } = getTaskColumns(t);
        return status === 'On Hold' && (comment === '' || !comment.includes('Onhold'));
      });

      expect(onHoldTasks, `Missing comment for the onhold task: ${JSON.stringify(onHoldTasks, null, 2)}`).toEqual([]);
    });
  });

  describe('Task time breakdown', () => {
    // If a task takes more than two days it should have task breakdown
    test('Task breakdown should not be empty for a longer task', () => {
      const moreThanTwoDaysTasks = tasks.filter((t) => {
        const { startDate, actualEndDate, taskTimebreakdown } = getTaskColumns(t);
        return startDate !== actualEndDate && (taskTimebreakdown === '' || taskTimebreakdown === undefined);
      });
      expect(moreThanTwoDaysTasks, `Missing task time breakdown: ${JSON.stringify(moreThanTwoDaysTasks, null, 2)}`).toEqual([]);
    });

    // Task breakdown and actual end date should be same
    test('Task breakdown and actual end date time should be same', () => {
      const moreThanTwoDaysTasks = tasks.filter((t) => {
        const { startDate, actualEndDate, taskTimebreakdown, status } = getTaskColumns(t);
        return status !== 'On Hold' && startDate !== actualEndDate && taskTimebreakdown !== '' && taskTimebreakdown !== undefined;
      });
      const calculatedTime = moreThanTwoDaysTasks.filter((t) => {
        const { actualEndDate, taskTimebreakdown } = getTaskColumns(t);
        const dateTimeBreakdown = taskTimebreakdown.split('\n');
        const lastDate = dateTimeBreakdown[dateTimeBreakdown.length - 1].split('-')[0].trim();
        // const timeBreakdown = dateTimeBreakdown.map((s) => s.split('-')).reduce((acc, val) => Number(val[1]) + acc, 0);

        return lastDate !== actualEndDate;
      });
      expect(calculatedTime, `Task time breakdown and actual end-date is not same: ${JSON.stringify(calculatedTime, null, 2)}`).toEqual([]);
    });

    // actual hours and task time breakdown should be same
    test('Actual hours and task time breakdown should be same', () => {
      const moreThanTwoDaysTasks = tasks.filter((t) => {
        const { startDate, actualEndDate, taskTimebreakdown } = getTaskColumns(t);
        return startDate !== actualEndDate && taskTimebreakdown !== '' && taskTimebreakdown !== undefined;
      });
      const calculatedTime = moreThanTwoDaysTasks.filter((t) => {
        const { actualHours, taskTimebreakdown, title } = getTaskColumns(t);
        const dateTimeBreakdown = taskTimebreakdown.split('\n');
        const totalTime = dateTimeBreakdown
          .map((s) => s.split('-'))
          .reduce((acc, val) => {
            const [hours, minutes] = val[1].trim().split(':');
            const minutesRoundoff = Math.round((Number(minutes) * 100) / 60) / 100;
            const totalTime = Number(hours) + minutesRoundoff;

            return totalTime + acc;
          }, 0);

        const res = Number(actualHours) !== totalTime;

        return res;
      });
      expect(calculatedTime, `Task time breakdown and actual hours is not same: ${JSON.stringify(calculatedTime, null, 2)}`).toEqual([]);
    });

    // Each working day should have at least 7.5 hours
  });

  // Each task should have all the columns filled
});
