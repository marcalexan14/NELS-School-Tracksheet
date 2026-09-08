"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// The academic-year "roll" on the first-run page: pick a year, adjust its exact
// start / end dates if your school's calendar differs from Sep–Jun.
export function SetupYearFields() {
  const now = new Date();
  const defaultStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const options = Array.from({ length: 8 }, (_, i) => defaultStartYear - 2 + i);

  const [startYear, setStartYear] = useState(defaultStartYear);
  const [start, setStart] = useState(`${defaultStartYear}-09-01`);
  const [end, setEnd] = useState(`${defaultStartYear + 1}-06-30`);

  function chooseYear(y: number) {
    setStartYear(y);
    setStart(`${y}-09-01`);
    setEnd(`${y + 1}-06-30`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="yearName">Academic year</Label>
        <select
          id="yearName"
          name="yearName"
          value={`${startYear} / ${startYear + 1}`}
          onChange={(e) => chooseYear(Number(e.target.value.slice(0, 4)))}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          {options.map((y) => (
            <option key={y} value={`${y} / ${y + 1}`}>
              {y} / {y + 1}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="yearStart">Starts</Label>
        <Input id="yearStart" name="yearStart" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="yearEnd">Ends</Label>
        <Input id="yearEnd" name="yearEnd" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
      </div>
    </div>
  );
}
