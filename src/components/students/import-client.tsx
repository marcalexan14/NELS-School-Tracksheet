"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  previewStudentImport,
  commitStudentImport,
  type PreviewState,
  type CommitState,
} from "@/app/actions/import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Initial states live here, not in the "use server" module (which may only
// export async functions).
const emptyPreview: PreviewState = { step: "idle", rows: [], validCount: 0, errorCount: 0 };
const commitInitial: CommitState = { done: false, created: 0, enrolled: 0, skipped: 0 };

export function ImportClient({ templateHref }: { templateHref: string }) {
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(
    previewStudentImport,
    emptyPreview,
  );
  const [commit, commitAction, committing] = useActionState<CommitState, FormData>(
    commitStudentImport,
    commitInitial,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const validRows = preview.rows.filter((r) => r.data);
  const payload = JSON.stringify(validRows.map((r) => r.data));

  if (commit.done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <p className="text-lg font-medium">{commit.message}</p>
          <div className="flex gap-2">
            <Button nativeButton={false} render={<Link href="/dashboard/students" />}>View students</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Import another file</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Students
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Get the template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Download the Excel template, fill one row per student, and keep the header row. The
            <strong className="text-foreground"> Grades </strong> sheet lists the exact grade names to
            use in the <em>Grade</em> column (leave it blank to import without enrolling).
          </p>
          <Button variant="outline" nativeButton={false} render={<a href={templateHref} />}>
            <FileSpreadsheet className="h-4 w-4" /> Download template (.xlsx)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2 · Upload and preview</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={previewAction} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
            <Button type="submit" disabled={previewing}>
              <Upload className="h-4 w-4" /> {previewing ? "Reading…" : "Preview"}
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </form>
          {preview.step === "error" && (
            <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {preview.message}
            </p>
          )}
        </CardContent>
      </Card>

      {preview.step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge>{preview.validCount} ready</Badge>
              {preview.errorCount > 0 && <Badge variant="destructive">{preview.errorCount} with errors</Badge>}
              {preview.message && <span className="text-muted-foreground">{preview.message}</span>}
            </div>

            <div className="max-h-[460px] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="font-ar">{r.display.name || "—"}</TableCell>
                      <TableCell>{r.display.grade}</TableCell>
                      <TableCell className="font-ar">{r.display.guardian}</TableCell>
                      <TableCell>
                        {r.data ? (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" /> ready
                          </span>
                        ) : (
                          <span className="text-xs text-destructive">{r.errors.join("; ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <form action={commitAction} className="flex items-center gap-3">
              <input type="hidden" name="payload" value={payload} />
              <Button type="submit" disabled={committing || preview.validCount === 0}>
                {committing ? "Importing…" : `Import ${preview.validCount} student${preview.validCount === 1 ? "" : "s"}`}
              </Button>
              {preview.errorCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  Rows with errors are skipped. Fix them in Excel and re-upload to add them.
                </span>
              )}
            </form>
            {commit.message && !commit.done && (
              <p className="text-sm text-destructive">{commit.message}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
