import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function RestoreDraftDialog({
  open,
  onRestore,
  onDiscard,
}: {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-center gap-2 text-orange-600">
            检测到未完成答题记录
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-1 text-center text-sm">
            继续作答将恢复答案和计时，重新作答会清空本地记录。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 flex w-full flex-row gap-4 sm:justify-center">
          <Button variant="outline" onClick={onRestore} className="flex-1">
            继续作答
          </Button>
          <Button onClick={onDiscard} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">
            重新作答
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
